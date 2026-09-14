import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Avatar, Button, Card, List, Spin, Tag, Toast } from '@douyinfe/semi-ui';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  Boxes,
  CheckCircle2,
  ChevronRight,
  Clock,
  Database,
  GitBranch,
  Grid2x2,
  Plug,
  RefreshCw,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { completeTask, getPendingTasks } from '@/api/dashboard/approvals';
import {
  getDashboardSummary,
  type ActiveAgent,
  type DashboardStat,
  type QuickLink,
  type RecentTask,
} from '@/api/dashboard/workbench';
import { useAuth } from '@mate/shared';
import { EmptyState, PageHeader } from '@/components/skeleton';
import type { ApprovalTask } from '@/types';
import './home.css';

/** 后端返回的是图标名字符串，按名字/label 兜底映射；未命中用通用图标。 */
const ICONS: Record<string, LucideIcon> = {
  boxes: Boxes,
  bot: Bot,
  'check-circle': CheckCircle2,
  clock: Clock,
  Sparkles,
  Boxes2: Boxes,
  Database,
  Plug,
  GitBranch,
  GridSquare: Grid2x2,
};

const FALLBACK_ICON = Grid2x2;

function iconFor(key: string | undefined, fallback: LucideIcon = FALLBACK_ICON): LucideIcon {
  if (!key) return fallback;
  return ICONS[key] ?? ICONS[key.toLowerCase()] ?? fallback;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return '凌晨好';
  if (h < 12) return '早上好';
  if (h < 18) return '下午好';
  return '晚上好';
}

/**
 * 工作台 · 概览（DESIGN-SPEC §5 版式 A：页头 + KPI bento + 主列/侧列）。
 *
 * 数据全部来自 src/api/dashboard/workbench（一次 summary 调用）+ approvals：
 *  - KPI 行 = summary.stats（后端给的统计口径，不做本地硬编码）
 *  - 今日动态 = summary.recentTasks
 *  - 快捷入口 = summary.quickLinks
 *  - 待办审批 = getPendingTasks + completeTask（平台 HITL 的统一入口）
 *  - 数字员工状态 = summary.activeAgents
 *
 * 说明：原型 KPI 卡带 sparkline；后端没有「按 KPI 的时间序列」接口
 * （metrics 的 trend 只给平台级 apiCalls/errors），故这里只呈现真实趋势值，
 * 不画假曲线。
 */
export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<DashboardStat[]>([]);
  const [recentTasks, setRecentTasks] = useState<RecentTask[]>([]);
  const [activeAgents, setActiveAgents] = useState<ActiveAgent[]>([]);
  const [quickLinks, setQuickLinks] = useState<QuickLink[]>([]);
  const [pending, setPending] = useState<ApprovalTask[]>([]);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [summaryRes, pendingRes] = await Promise.allSettled([
      getDashboardSummary(),
      getPendingTasks(),
    ]);
    if (summaryRes.status === 'fulfilled') {
      const s = summaryRes.value;
      setStats(s.stats ?? []);
      setRecentTasks(s.recentTasks ?? []);
      setActiveAgents(s.activeAgents ?? []);
      setQuickLinks(s.quickLinks ?? []);
    } else {
      setError(
        summaryRes.reason instanceof Error ? summaryRes.reason.message : String(summaryRes.reason),
      );
    }
    setPending(pendingRes.status === 'fulfilled' ? (pendingRes.value.items ?? []) : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = useCallback(
    async (task: ApprovalTask, action: 'approve' | 'reject') => {
      setActing(task.taskId);
      try {
        await completeTask(task.taskId, action, action === 'approve' ? '通过' : '驳回');
        Toast.success(action === 'approve' ? `已通过「${task.title}」` : `已驳回「${task.title}」`);
        setPending((prev) => prev.filter((t) => t.taskId !== task.taskId));
      } catch (e) {
        Toast.error(e instanceof Error ? e.message : String(e));
      } finally {
        setActing(null);
      }
    },
    [],
  );

  /**
   * 三态渲染：加载中（且尚无数据）→ 占位；否则空 → 空态；否则内容。
   * 直接在「是否为空」上分支会让加载期间先闪一次假空态。
   */
  const body = (isEmpty: boolean, emptyNode: ReactNode, content: ReactNode) =>
    loading && isEmpty ? (
      <div className="mp-home-loading">
        <Spin size="small" />
      </div>
    ) : isEmpty ? (
      emptyNode
    ) : (
      content
    );

  const displayName = user?.realName ?? user?.username ?? '当前用户';
  const today = useMemo(
    () =>
      new Date().toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
      }),
    [],
  );

  return (
    <>
      <PageHeader
        title={`${greeting()}，${displayName}`}
        desc={
          pending.length > 0
            ? `${today} · ${pending.length} 项审批等待你确认`
            : `${today} · 暂无待办审批`
        }
        actions={
          <>
            <Button
              icon={<RefreshCw size={15} strokeWidth={1.5} />}
              loading={loading}
              onClick={() => void load()}
            >
              刷新
            </Button>
            <Button
              theme="solid"
              type="primary"
              icon={<Sparkles size={15} strokeWidth={1.5} />}
              onClick={() => navigate('/superai/chat')}
            >
              问 SuperAI
            </Button>
          </>
        }
      />

      {error ? (
        <EmptyState
          illustration="failure"
          title="工作台数据加载失败"
          desc={error}
          actions={
            <Button theme="solid" type="primary" onClick={() => void load()}>
              重试
            </Button>
          }
        />
      ) : (
        <>
          <div className="mp-home-kpis">
            {stats.length === 0 && !loading ? (
              <Card>
                <span className="mp-home-kpi-label">暂无统计口径</span>
              </Card>
            ) : (
              stats.slice(0, 4).map((s) => {
                const Icon = iconFor(s.icon);
                return (
                  <Card key={`${s.label}-${s.value}`}>
                    <div className="mp-home-kpi">
                      <span className="mp-home-kpi-label">
                        <Icon size={14} strokeWidth={1.5} />
                        {s.label}
                      </span>
                      <div className="mp-home-kpi-row">
                        <span className="mp-home-kpi-value">{s.value}</span>
                        {s.trend_value ? (
                          <span className={`mp-home-kpi-trend ${s.trend_up ? 'is-up' : 'is-down'}`}>
                            {s.trend_up ? (
                              <ArrowUpRight size={13} strokeWidth={1.6} />
                            ) : (
                              <ArrowDownRight size={13} strokeWidth={1.6} />
                            )}
                            {s.trend_value}
                            {s.trend_label ? ` · ${s.trend_label}` : ''}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>

          <div className="mp-home-grid">
            <div className="mp-home-col">
              <Card
                className="mp-home-card-feed"
                title="今日动态"
                headerExtraContent={
                  <Button theme="borderless" type="primary" size="small" onClick={() => navigate('/agents')}>
                    查看全部
                  </Button>
                }
              >
                {body(
                  recentTasks.length === 0,
                  <EmptyState
                    illustration="no-content"
                    title="今天还没有任务动态"
                    desc="数字员工执行任务后，这里会实时出现。"
                  />,
                  <List
                    dataSource={recentTasks}
                    split={false}
                    renderItem={(t: RecentTask) => (
                      <List.Item
                        main={
                          <span className="mp-home-feed-row">
                            <span className="mp-home-feed-main">
                              <span className="mp-home-feed-title">{t.name}</span>
                              <span className="mp-home-feed-meta">
                                {t.agent}
                                {t.type_label ? ` · ${t.type_label}` : ''} · {t.time}
                              </span>
                            </span>
                            <Tag type="light">{t.status}</Tag>
                          </span>
                        }
                      />
                    )}
                  />
                )}
              </Card>

              <Card
                className="mp-home-card-links"
                title="快捷入口"
                headerExtraContent={
                  <Button theme="borderless" type="primary" size="small" onClick={() => navigate('/apps/mine')}>
                    全部应用
                  </Button>
                }
              >
                {body(
                  quickLinks.length === 0,
                  <EmptyState illustration="no-content" title="暂无快捷入口" desc="常用入口会出现在这里。" />,
                  <div className="mp-home-links">
                    {quickLinks.map((q) => {
                      const Icon = iconFor(q.icon);
                      return (
                        <button
                          key={q.id}
                          type="button"
                          className="mp-home-link"
                          onClick={() => {
                            if (q.link) navigate(q.link);
                          }}
                        >
                          <Icon size={15} strokeWidth={1.5} />
                          {q.label}
                          <ChevronRight size={14} strokeWidth={1.5} />
                        </button>
                      );
                    })}
                  </div>,
                )}
              </Card>
            </div>

            <div className="mp-home-col">
              <Card
                className="mp-home-card-todos"
                title="待办审批"
                headerExtraContent={
                  pending.length > 0 ? (
                    <Tag color="amber" type="light">
                      {pending.length}
                    </Tag>
                  ) : undefined
                }
              >
                {body(
                  pending.length === 0,
                  <EmptyState
                    illustration="no-content"
                    title="没有待办审批"
                    desc="需要人工确认的 Action 与计划会集中在这里。"
                  />,
                  <List
                    dataSource={pending}
                    split={false}
                    renderItem={(task: ApprovalTask) => (
                      <List.Item
                        main={
                          <span className="mp-home-todo">
                            <span className="mp-home-todo-main">
                              <span className="mp-home-feed-title">{task.title}</span>
                              <span className="mp-home-feed-meta">
                                {task.applicant}
                                {task.flowName ? ` · ${task.flowName}` : ''}
                              </span>
                            </span>
                            <span className="mp-home-todo-actions">
                              <Button
                                theme="solid"
                                type="primary"
                                size="small"
                                loading={acting === task.taskId}
                                onClick={() => void decide(task, 'approve')}
                              >
                                通过
                              </Button>
                              <Button
                                theme="borderless"
                                type="tertiary"
                                size="small"
                                disabled={acting === task.taskId}
                                onClick={() => void decide(task, 'reject')}
                              >
                                驳回
                              </Button>
                            </span>
                          </span>
                        }
                      />
                    )}
                  />
                )}
              </Card>

              <Card
                className="mp-home-card-agents"
                title="数字员工状态"
                headerExtraContent={
                  <Button theme="borderless" type="primary" size="small" onClick={() => navigate('/agents')}>
                    管理
                  </Button>
                }
              >
                {body(
                  activeAgents.length === 0,
                  <EmptyState illustration="no-content" title="暂无在线员工" desc="招聘并启用数字员工后会出现在这里。" />,
                  <List
                    dataSource={activeAgents}
                    split={false}
                    renderItem={(a: ActiveAgent) => (
                      <List.Item
                        main={
                          <span className="mp-home-agent">
                            <Avatar size="small" color="light-blue">
                              {a.name.slice(0, 1)}
                            </Avatar>
                            <span className="mp-home-agent-main">
                              <span className="mp-home-agent-name">{a.name}</span>
                              <span className="mp-home-agent-type">
                                {a.type}
                                {typeof a.tasks === 'number' ? ` · ${a.tasks} 个任务` : ''}
                              </span>
                            </span>
                            <Tag type="light">{a.status_label}</Tag>
                          </span>
                        }
                      />
                    )}
                  />
                )}
              </Card>
            </div>
          </div>
        </>
      )}
    </>
  );
}
