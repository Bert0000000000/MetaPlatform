import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
import ProductOnboarding from './components/ProductOnboarding';
import './home.css';

/** 后端返回的是图标名字符串，按名字/label 兜底映射；未命中用通用图标。 */
const ICONS: Record<string, LucideIcon> = {
  Robot: Sparkles, AppstoreOutlined: Grid2x2, ApartmentOutlined: Boxes, ApiOutlined: Plug, TeamOutlined: Bot, ClusterOutlined: GitBranch,
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
 *  - 待办审批 = getPendingTasks + completeTask（当前提供者是未绑定账号的演示队列）
 *  - 数字员工状态 = summary.activeAgents
 *
 * 说明：原型 KPI 卡带 sparkline；后端没有「按 KPI 的时间序列」接口
 * （metrics 的 trend 只给平台级 apiCalls/errors），故这里只呈现提供者的趋势值，
 * 不画假曲线。
 */
export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summaryReady, setSummaryReady] = useState(false);
  const [stats, setStats] = useState<DashboardStat[]>([]);
  const [recentTasks, setRecentTasks] = useState<RecentTask[]>([]);
  const [activeAgents, setActiveAgents] = useState<ActiveAgent[]>([]);
  const [quickLinks, setQuickLinks] = useState<QuickLink[]>([]);
  const [pending, setPending] = useState<ApprovalTask[]>([]);
  const [pendingTotal, setPendingTotal] = useState<number | null>(null);
  const [statsSource, setStatsSource] = useState<'demo' | 'live'>('demo');
  const [pendingError, setPendingError] = useState('');
  const [pendingLoading, setPendingLoading] = useState(true);
  const [acting, setActing] = useState<Set<string>>(() => new Set());
  const inFlight = useRef(new Set<string>());
  const pendingRequest = useRef(0);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const s = await getDashboardSummary();
      setStats(s.stats ?? []);
      setStatsSource(s.statsSource ?? 'demo');
      setRecentTasks(s.recentTasks ?? []);
      setActiveAgents(s.activeAgents ?? []);
      setQuickLinks(s.quickLinks ?? []);
      setSummaryReady(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }, []);
  const loadPending = useCallback(async () => {
    const request = ++pendingRequest.current;
    setPendingLoading(true);
    setPendingError('');
    try {
      const page = await getPendingTasks();
      if (request !== pendingRequest.current) return;
      setPending(page.items ?? []);
      setPendingTotal(page.total ?? page.items?.length ?? 0);
    }
    catch (e) { if (request === pendingRequest.current) setPendingError(e instanceof Error ? e.message : String(e)); }
    finally { if (request === pendingRequest.current) setPendingLoading(false); }
  }, []);
  const load = useCallback(() => Promise.allSettled([loadSummary(), loadPending()]), [loadSummary, loadPending]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = useCallback(
    async (task: ApprovalTask, action: 'approve' | 'reject') => {
      if (inFlight.current.has(task.taskId)) return;
      inFlight.current.add(task.taskId);
      setActing(prev => new Set(prev).add(task.taskId));
      try {
        await completeTask(task.taskId, action, action === 'approve' ? '通过' : '驳回');
        Toast.success(action === 'approve' ? `已通过「${task.title}」` : `已驳回「${task.title}」`);
        setPending((prev) => prev.filter((t) => t.taskId !== task.taskId));
        await loadPending();
      } catch (e) {
        Toast.error(e instanceof Error ? e.message : String(e));
      } finally {
        inFlight.current.delete(task.taskId);
        setActing(prev => { const next = new Set(prev); next.delete(task.taskId); return next; });
      }
    },
    [loadPending],
  );

  /**
   * 三态渲染：加载中（且尚无数据）→ 占位；否则空 → 空态；否则内容。
   * 直接在「是否为空」上分支会让加载期间先闪一次假空态。
   */
  const body = (isEmpty: boolean, emptyNode: ReactNode, content: ReactNode, busy = loading) =>
    busy && isEmpty ? (
      <div className="mp-home-loading">
        <Spin size="small" />
      </div>
    ) : isEmpty ? (
      emptyNode
    ) : (
      content
    );
  const summaryBody = (isEmpty: boolean, emptyNode: ReactNode, content: ReactNode) =>
    error && !summaryReady ? <p>汇总读取未完成，请重试汇总。</p> : body(isEmpty, emptyNode, content);

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
      <ProductOnboarding />
      <PageHeader
        title={`${greeting()}，${displayName}`}
        desc={
          pendingError ? `${today} · 审批读取未完成` : pendingLoading ? `${today} · 正在读取审批` : (pendingTotal ?? 0) > 0
            ? `${today} · ${pendingTotal} 项演示审批`
            : `${today} · 暂无演示待办审批`
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
            <Button theme="solid" type="primary" onClick={() => void loadSummary()}>
              重试
            </Button>
          }
        />
      ) : null}
      {error && summaryReady && <p role="status">下方保留上次成功读取的汇总，请重试后核对。</p>}
      {
        <>
          <div className="mp-home-kpis" hidden={!!error && !summaryReady}>
            {stats.length === 0 && !loading ? (
              <Card>
                <span className="mp-home-kpi-label">暂无统计口径</span>
              </Card>
            ) : (
              stats.slice(0, 4).map((s) => {
                const approval = s.label === '待处理审批' || s.label === '我的待办审批';
                const Icon = iconFor(s.icon);
                return (
                  <Card key={`${s.label}-${s.value}`}>
                    <div className="mp-home-kpi">
                      <span className="mp-home-kpi-label">
                        <Icon size={14} strokeWidth={1.5} />
                        {approval ? '演示待办审批' : s.label}
                        {!approval && statsSource === 'demo' && <Tag size="small">演示统计</Tag>}
                      </span>
                      <div className="mp-home-kpi-row">
                        <span className="mp-home-kpi-value">{approval ? pendingLoading || pendingError ? '—' : pendingTotal ?? '—' : s.value}</span>
                        {!approval && s.trend_value ? (
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
                title={statsSource === 'demo' ? '今日动态（演示）' : '今日动态'}
                headerExtraContent={
                  <Button theme="borderless" type="primary" size="small" onClick={() => navigate('/agents')}>
                    查看全部
                  </Button>
                }
              >
                {summaryBody(
                  recentTasks.length === 0,
                  <EmptyState
                    illustration="no-content"
                    title="今天还没有任务动态"
                    desc={statsSource === 'demo' ? '暂无演示任务动态。' : '数字员工执行任务后，这里会实时出现。'}
                  />,
                  <List
                    dataSource={recentTasks}
                    split={false}
                    renderItem={(t: RecentTask) => (
                      <List.Item
                        children={
                          <span className="mp-home-feed-row">
                            <span className="mp-home-feed-main">
                              <span className="mp-home-feed-title">{t.name}</span>
                              <span className="mp-home-feed-meta">
                                {t.agent}
                                {t.type_label ? ` · ${t.type_label}` : ''} · {t.time}
                              </span>
                            </span>
                            <Tag type="light" color={t.status === 'failed' ? 'red' : t.status === 'running' ? 'blue' : t.status === 'done' ? 'green' : 'grey'}>{({ done: '已完成', running: '进行中', failed: '失败', pending: '待处理' } as Record<string, string>)[t.status] ?? t.status}</Tag>
                          </span>
                        }
                      />
                    )}
                  />
                )}
              </Card>

              <Card
                className="mp-home-card-links"
                title="继续工作"
                headerExtraContent={
                  <Button theme="borderless" type="primary" size="small" onClick={() => navigate('/apps/mine')}>
                    全部应用
                  </Button>
                }
              >
                {summaryBody(
                  quickLinks.length === 0,
                  <EmptyState illustration="no-content" title="暂无快捷入口" desc="常用入口会出现在这里。" />,
                  <div className="mp-home-links">
                    {quickLinks.map((q) => {
                      const Icon = iconFor(q.icon);
                      return (
                        <button
                          key={q.link}
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
                title="演示待办审批"
                headerExtraContent={
                  pending.length > 0 ? (
                    <Tag color="amber" type="light">
                      {pendingTotal ?? pending.length}
                    </Tag>
                  ) : undefined
                }
              >
                {pendingError ? <div role="alert"><p>{pendingError}</p><Button loading={pendingLoading} onClick={() => void loadPending()}>重试审批</Button>{pending.length > 0 && <p>下方保留上次读取的审批，请重试后确认。</p>}</div> : null}
                {pendingError && pending.length === 0 ? null : pendingLoading && pending.length === 0 ? <div className="mp-home-loading"><Spin size="small" /></div> : body(
                  pending.length === 0,
                  <EmptyState
                    illustration="no-content"
                    title={(pendingTotal ?? 0) > 0 ? '当前页没有待办记录' : '没有待办审批'}
                    desc="这里展示演示审批流程。"
                  />,
                  <List
                    dataSource={pending}
                    split={false}
                    renderItem={(task: ApprovalTask) => (
                      <List.Item
                        children={
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
                                loading={acting.has(task.taskId)}
                                disabled={acting.has(task.taskId)}
                                onClick={() => void decide(task, 'approve')}
                              >
                                通过
                              </Button>
                              <Button
                                theme="borderless"
                                type="tertiary"
                                size="small"
                                disabled={acting.has(task.taskId)}
                                onClick={() => void decide(task, 'reject')}
                              >
                                驳回
                              </Button>
                            </span>
                          </span>
                        }
                      />
                    )}
                  />,
                  pendingLoading
                )}
              </Card>

              <Card
                className="mp-home-card-agents"
                title={statsSource === 'demo' ? '数字员工状态（演示）' : '数字员工状态'}
                headerExtraContent={
                  <Button theme="borderless" type="primary" size="small" onClick={() => navigate('/agents')}>
                    管理
                  </Button>
                }
              >
                {summaryBody(
                  activeAgents.length === 0,
                  <EmptyState illustration="no-content" title="暂无员工状态" desc={statsSource === 'demo' ? '暂无演示员工状态。' : '员工的实际状态会显示在这里。'} />,
                  <List
                    dataSource={activeAgents}
                    split={false}
                    renderItem={(a: ActiveAgent) => (
                      <List.Item
                        children={
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
                            <Tag type="light" color={a.status_label === '忙碌' ? 'amber' : a.status_label === '在线' ? 'green' : 'grey'}>{a.status_label || '状态未知'}</Tag>
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
      }
    </>
  );
}
