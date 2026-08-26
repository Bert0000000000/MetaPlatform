import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  IconPlus,
  IconFile,
  IconUserGroup,
  IconUserAdd,
  IconRefresh,
  IconAppCenter,
  IconTickCircle,
  IconClock,
  IconBolt,
  IconGridSquare,
  IconLayers,
  IconLink,
  IconTerminal,
  IconBranch,
  IconPaperclip,
} from '@douyinfe/semi-icons';
import { Toast, Button, Card, Typography, SideSheet, Tag } from '@douyinfe/semi-ui';
import { FormDrawer, Field, PageRoot, TextInput, TextArea, Select, useAuth } from '@mate/shared';
import { getDashboardSummary, getMessages, getDeliverablesSummary, type DashboardSummary, type DashboardStat, type RecentTask, type SystemHealthItem, type ActiveAgent, type MessageItem, type DeliverableItem } from '@/api/dashboard/workbench';

// 子标签页

// FALLBACK: 当 BFF 不可达时使用，与 API 返回结构一致（snake_case）
const FALLBACK: DashboardSummary = {
  stats: [
    { label: '活跃应用', value: '18', trend_label: '本周', trend_value: '+3', trend_up: true, icon: 'boxes' },
    { label: '数字员工在线', value: '8/12', trend_label: '', trend_value: '运行中', trend_up: true, icon: 'bot' },
    { label: '今日任务', value: '234', trend_label: '较昨日', trend_value: '+18%', trend_up: true, icon: 'check-circle' },
    { label: '待处理审批', value: '5', trend_label: '', trend_value: '需要关注', trend_up: false, icon: 'clock' },
  ],
  recentTasks: [
    { name: '财务报销审核', type_label: '审批', type_class: 'v-badge-purple', agent: '合同审核员', status: '完成', status_class: 'v-badge-success', time: '10 分钟前' },
    { name: '客户数据周报生成', type_label: '分析', type_class: 'v-badge-cyan', agent: '数据分析师', status: '进行中', status_class: 'v-badge-warning', time: '25 分钟前' },
    { name: '安全漏洞扫描', type_label: '巡检', type_class: 'v-badge-blue', agent: '安全巡检员', status: '失败', status_class: 'v-badge-error', time: '42 分钟前' },
    { name: '营销邮件撰写', type_label: '生成', type_class: 'v-badge-neutral', agent: '营销文案', status: '完成', status_class: 'v-badge-success', time: '1 小时前' },
    { name: '知识库索引重建', type_label: '维护', type_class: 'v-badge-neutral', agent: '知识库管理员', status: '完成', status_class: 'v-badge-success', time: '2 小时前' },
    { name: 'PR 代码审查', type_label: '审核', type_class: 'v-badge-purple', agent: '代码审查员', status: '等待中', status_class: 'v-badge-warning', time: '3 小时前' },
    { name: '订单数据对账', type_label: '对账', type_class: 'v-badge-blue', agent: '财务对账员', status: '完成', status_class: 'v-badge-success', time: '4 小时前' },
    { name: '客户投诉回复', type_label: '回复', type_class: 'v-badge-cyan', agent: '客服小助手', status: '完成', status_class: 'v-badge-success', time: '5 小时前' },
    { name: '产品需求评审', type_label: '评审', type_class: 'v-badge-purple', agent: '产品助理', status: '等待中', status_class: 'v-badge-warning', time: '6 小时前' },
    { name: '供应链异常告警', type_label: '监控', type_class: 'v-badge-blue', agent: '供应链监控员', status: '完成', status_class: 'v-badge-success', time: '7 小时前' },
    { name: '数据质量检查', type_label: '巡检', type_class: 'v-badge-blue', agent: '数据质量巡检员', status: '完成', status_class: 'v-badge-success', time: '昨天 18:42' },
    { name: '合同条款比对', type_label: '审核', type_class: 'v-badge-purple', agent: '合同审核员', status: '失败', status_class: 'v-badge-error', time: '昨天 17:30' },
    { name: '周报自动生成', type_label: '生成', type_class: 'v-badge-neutral', agent: '知识库管理员', status: '完成', status_class: 'v-badge-success', time: '昨天 16:15' },
    { name: '客户画像更新', type_label: '分析', type_class: 'v-badge-cyan', agent: '数据分析师', status: '进行中', status_class: 'v-badge-warning', time: '昨天 14:50' },
    { name: '服务器健康巡检', type_label: '巡检', type_class: 'v-badge-blue', agent: '运维巡检员', status: '完成', status_class: 'v-badge-success', time: '昨天 11:00' },
  ],
  systemHealth: [
    { dot_class: 'health-dot-ok', name: 'LLM Gateway', detail: '响应正常，P99 120ms', status: '正常' },
    { dot_class: 'health-dot-ok', name: 'MCP Registry', detail: '已注册 23 个服务', status: '正常' },
    { dot_class: 'health-dot-warn', name: 'Kafka 消息队列', detail: 'Lag 偏高 (1,204)', status: '告警' },
  ],
  activeAgents: [
    { dot_class: 'agent-mini-dot-online', name: '客服助手', type: '对话型', tasks: 23, status_bg: 'var(--success-subtle)', status_color: 'var(--success)', status_label: '在线' },
    { dot_class: 'agent-mini-dot-busy', name: '合同审核员', type: '审核型', tasks: 8, status_bg: 'var(--warning-subtle)', status_color: 'var(--warning)', status_label: '处理中' },
    { dot_class: 'agent-mini-dot-online', name: '营销文案', type: '生成型', tasks: 15, status_bg: 'var(--success-subtle)', status_color: 'var(--success)', status_label: '在线' },
    { dot_class: 'agent-mini-dot-online', name: '代码审查员', type: '审核型', tasks: 6, status_bg: 'var(--success-subtle)', status_color: 'var(--success)', status_label: '在线' },
  ],
  quickLinks: [],
};

// 相对时间格式化（dashboard 数据新鲜度指示）
function formatRelativeTime(d: Date): string {
  const ms = Date.now() - d.getTime();
  if (ms < 60_000) return '刚刚';
  if (ms < 3_600_000) return Math.floor(ms / 60_000) + ' 分钟前';
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

// 快捷入口图标映射：key 兼容后端 antd 图标名 + 前端 FALLBACK 旧名，value 用 Semi 图标
const QUICK_LINK_ICONS: Record<string, React.ComponentType<any>> = {
  // 后端返回的 antd 图标名
  Robot: IconBolt,
  AppstoreOutlined: IconGridSquare,
  ApartmentOutlined: IconLayers,
  ApiOutlined: IconLink,
  TeamOutlined: IconUserGroup,
  ClusterOutlined: IconBranch,
  // FALLBACK 旧名（后端不可达时）
  Sparkles: IconBolt,
  Boxes: IconGridSquare,
  Database: IconLayers,
  Plug: IconLink,
  Bot: IconTerminal,
  GitBranch: IconBranch,
};

// 统计卡图标：后端 stats 无 icon 字段，按 label 兜底
const STAT_ICONS: Record<string, React.ComponentType<any>> = {
  boxes: IconAppCenter,
  bot: IconUserGroup,
  'check-circle': IconTickCircle,
  clock: IconClock,
  '活跃应用': IconAppCenter,
  '数字员工在线': IconUserGroup,
  '今日任务': IconTickCircle,
  '待处理审批': IconClock,
};

// 简单的骨架屏组件（性能：避免 layout shift）
const SkeletonBox: React.FC<{ width?: string; height?: string; style?: React.CSSProperties }> = ({ width = '100%', height = '14px', style }) => (
  <div
    style={{
      width,
      height,
      background: 'linear-gradient(90deg, var(--muted) 0%, var(--border) 50%, var(--muted) 100%)',
      backgroundSize: '200% 100%',
      animation: 'workbench-shimmer 1.4s ease-in-out infinite',
      borderRadius: 'var(--radius)',
      ...style,
    }}
  />
);

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [deliverablesOpen, setDeliverablesOpen] = useState(false);
    const [deliverables, setDeliverables] = useState<DeliverableItem[]>([]);
    const [recentMessages, setRecentMessages] = useState<MessageItem[]>([]);
  const [detailMessage, setDetailMessage] = useState<MessageItem | null>(null);

  // 交付材料 + 最近消息（懒加载：打开抽屉/渲染时拉取）
  useEffect(() => {
    let cancelled = false;
    getMessages()
      .then((items) => {
        if (!cancelled) setRecentMessages(items.slice(0, 5));
      })
      .catch(() => {
        // 静默：后端不可达时展示空列表
      });
    getDeliverablesSummary()
      .then((summary) => {
        if (!cancelled) setDeliverables(summary.deliverables ?? []);
      })
      .catch(() => {
        // 静默
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const [tasksDrawerOpen, setTasksDrawerOpen] = useState(false);
  const [tasksPage, setTasksPage] = useState(1);
  const tasksPageSize = 5;
const REFRESH_INTERVAL_MS = 60_000; // 60s 自动刷新

  // 数据状态：先渲染 FALLBACK（避免白屏），后台异步替换为 API 数据
  const [data, setData] = useState<DashboardSummary>(FALLBACK);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'api' | 'fallback'>('fallback');



  // 数据新鲜度 + 定时自动刷新（useRef 避免 setInterval 闭包陷阱）
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const loadDashboard = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await getDashboardSummary();
      setData(res);
      setSource('api');
      setLastUpdated(new Date());
    } catch (e) {
      setSource('fallback');
      Toast.warning('仪表盘加载失败，已使用本地默认数据：' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);
  const fetchRef = useRef(loadDashboard);
  fetchRef.current = loadDashboard;
  // 初次加载（mount 时拉一次，触发 lastUpdated 设置）
  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    loadDashboard();
    // 仅 mount 一次；后续刷新走 setInterval / onClick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const id = setInterval(() => { fetchRef.current(); }, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // 派生数据 useMemo（性能：避免每次 render 重新计算）
  const tasksPageTotal = useMemo(
    () => Math.max(1, Math.ceil((data.recentTasksTotal ?? data.recentTasks.length) / tasksPageSize)),
    [(data.recentTasksTotal ?? data.recentTasks.length), tasksPageSize]
  );
  const pagedTasks = useMemo(() => {
    const start = (tasksPage - 1) * tasksPageSize;
    return data.recentTasks.slice(start, start + tasksPageSize);
  }, [data.recentTasks, tasksPage, tasksPageSize]);

  // 当数据更新导致总页数变小时，收敛当前页码
  useEffect(() => {
    if (tasksPage > tasksPageTotal) setTasksPage(tasksPageTotal);
  }, [tasksPage, tasksPageTotal]);

  // 渲染统计卡片（数据驱动；带图标 + hover 微动效）
  const renderStat = (s: DashboardStat) => {
    const Icon = STAT_ICONS[s.icon] ?? STAT_ICONS[s.label] ?? IconAppCenter;
    return (
      <div
        key={s.label}
        className="v-stat-card"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 14, cursor: 'pointer', transition: 'transform 120ms ease, box-shadow 120ms ease' }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = ''; }}
      >
        <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--semi-color-primary-light-default)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size="large" />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="v-stat-label">{s.label}</span>
          <span className="v-stat-value" style={s.trend_up === false ? { color: 'var(--warning)' } : undefined}>
            {s.value}
          </span>
          <span className="v-stat-change">
            {s.trend_label ? `${s.trend_label} ` : ''}
            {s.trend_value && (
              <span className={s.trend_up ? 'up' : 'down'}>{s.trend_value}</span>
            )}
          </span>
        </div>
      </div>
    );
  };

  return (
    <PageRoot>

      <div style={{ padding: '24px 0', flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {/* 欢迎卡 */}
        <div style={{
          background: 'linear-gradient(135deg, var(--semi-color-primary-light-default) 0%, var(--card) 55%)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: 24,
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>欢迎回来，{user?.realName ?? user?.username ?? '管理员'}</div>
            <div style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
              {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button theme="light" type="secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => setDrawerOpen(true)}>
              <IconPlus style={{ width: 16, height: 16 }} />创建应用
            </Button>
            <Button theme="light" type="secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => setDeliverablesOpen(true)}>
              <IconFile style={{ width: 16, height: 16 }} />交付材料
            </Button>
            <Button theme="solid" type="primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              onClick={() => navigate('/dashboard/my-agents')}>
              <IconUserAdd style={{ width: 16, height: 16 }} />管理数字员工
            </Button>
          </div>
        </div>

        {/* 统计行（API 驱动） */}
        <div className="v-stats-row" style={{ marginBottom: 24 }}>
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="v-stat-card">
                  <SkeletonBox width="40%" height="11px" style={{ marginBottom: 10 }} />
                  <SkeletonBox width="60%" height="22px" style={{ marginBottom: 8 }} />
                  <SkeletonBox width="50%" height="11px" />
                </div>
              ))
            : data.stats.map(renderStat)}
        </div>

        {/* 两栏：最近任务 + 系统状态 */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, alignItems: 'stretch' }}>
          {/* 左：最近任务 */}
          <div style={{ flex: 3, display: 'flex' }}>
            <Card style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>最近任务</div>
                  {source === 'fallback' && !loading && (
                    <span title="API 不可达，使用前端兜底数据" style={{ fontSize: 10, padding: '1px 6px', borderRadius: 9999, background: 'var(--warning-subtle)', color: 'var(--warning)' }}>本地数据</span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {lastUpdated && (
                    <span title={lastUpdated.toLocaleString('zh-CN')} style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                      最后更新 {formatRelativeTime(lastUpdated)}
                    </span>
                  )}
                  <Button theme="light" type="secondary" onClick={loadDashboard}
                    disabled={refreshing}
                    style={{ height: 28, padding: '0 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    title="刷新数据">
                    <IconRefresh size="small" spin={refreshing} />
                    刷新
                  </Button>
                  <Button theme="light" type="secondary" onClick={() => { setTasksPage(1); setTasksDrawerOpen(true); }} style={{ height: 28, padding: '0 10px', fontSize: 12 }}>查看全部</Button>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                {loading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 0' }}>
                    {Array.from({ length: tasksPageSize }).map((_, i) => (
                      <div key={i} style={{ display: 'flex', gap: 12 }}>
                        <SkeletonBox width="30%" height="14px" />
                        <SkeletonBox width="15%" height="14px" />
                        <SkeletonBox width="20%" height="14px" />
                        <SkeletonBox width="12%" height="14px" />
                        <SkeletonBox width="13%" height="14px" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>任务名</th>
                        <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>类型</th>
                        <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>数字员工</th>
                        <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>状态</th>
                        <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>时间</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedTasks.map((t, i) => (
                        <tr key={i}>
                          <td style={{ padding: '8px 12px', fontSize: 12, borderBottom: '1px solid var(--border)', fontWeight: 500 }}>{t.name}</td>
                          <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                            <span className={`v-badge ${t.type_class}`} style={{ borderRadius: 9999, padding: '2px 8px', fontSize: 11, fontWeight: 500, display: 'inline-block' }}>{t.type_label}</span>
                          </td>
                          <td style={{ padding: '8px 12px', fontSize: 12, borderBottom: '1px solid var(--border)' }}>{t.agent}</td>
                          <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                            <span className={`v-badge ${t.status_class}`} style={{ borderRadius: 9999, padding: '2px 8px', fontSize: 11, fontWeight: 500, display: 'inline-block' }}>{t.status}</span>
                          </td>
                          <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                            <span className="v-meta">{t.time}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                  第 {(tasksPage - 1) * tasksPageSize + 1} - {Math.min(tasksPage * tasksPageSize, (data.recentTasksTotal ?? data.recentTasks.length))} 条，共 {(data.recentTasksTotal ?? data.recentTasks.length)} 条
                </span>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <Button theme="light" type="secondary" disabled={tasksPage === 1}
                    onClick={() => setTasksPage((p) => Math.max(1, p - 1))}
                    style={{ height: 28, padding: '0 10px', fontSize: 12, opacity: tasksPage === 1 ? 0.5 : 1 }}
                  >
                    上一页
                  </Button>
                  {Array.from({ length: tasksPageTotal }).map((_, i) => (
                    <button
                      key={i}
                      className={tasksPage === i + 1 ? 'v-btn-primary' : 'v-btn'}
                      onClick={() => setTasksPage(i + 1)}
                      style={{ height: 28, minWidth: 28, padding: '0 8px', fontSize: 12 }}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <Button theme="light" type="secondary" disabled={tasksPage === tasksPageTotal}
                    onClick={() => setTasksPage((p) => Math.min(tasksPageTotal, p + 1))}
                    style={{ height: 28, padding: '0 10px', fontSize: 12, opacity: tasksPage === tasksPageTotal ? 0.5 : 1 }}
                  >
                    下一页
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* 右：最近消息 + 快捷入口 */}
          <div style={{ flex: 2, display: 'flex' }}>
            <Card style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>最近消息</div>
                <span
                  style={{ fontSize: 12, color: 'var(--muted-foreground)', cursor: 'pointer' }}
                  onClick={() => navigate('/dashboard/messages')}
                >
                  查看全部
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 20 }}>
                {recentMessages.length === 0
                  ? Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px' }}>
                        <SkeletonBox width="8px" height="8px" style={{ borderRadius: '50%' }} />
                        <div style={{ flex: 1 }}>
                          <SkeletonBox width="40%" height="12px" style={{ marginBottom: 4 }} />
                          <SkeletonBox width="70%" height="10px" />
                        </div>
                      </div>
                    ))
                  : recentMessages.map((m) => (
                      <div key={m.msg_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 'var(--radius)', cursor: 'pointer' }} onClick={() => setDetailMessage(m)}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: m.unread ? 'var(--semi-color-danger)' : 'var(--border)' }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: m.unread ? 500 : 400 }}>{m.title}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.summary}</div>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--muted-foreground)', flexShrink: 0 }}>{m.time}</div>
                      </div>
                    ))}
              </div>
              <div style={{ marginTop: 'auto' }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>快捷入口</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {(data.quickLinks.length > 0
                    ? data.quickLinks
                    : [
                        { id: 'superai', label: 'SuperAI', icon: 'Sparkles' },
                        { id: 'apps', label: '应用中心', icon: 'Boxes' },
                        { id: 'ontology', label: '本体引擎', icon: 'Database' },
                        { id: 'mcp', label: 'MCP 中心', icon: 'Plug' },
                        { id: 'agents', label: '数字员工', icon: 'Bot' },
                        { id: 'arch', label: '架构中心', icon: 'GitBranch' },
                      ]
                  ).map((q, i) => {
                    const Icon = QUICK_LINK_ICONS[q.icon] ?? IconGridSquare;
                    return (
                      <a
                        key={i}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 8,
                          padding: '14px 8px',
                          background: 'var(--muted)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius)',
                          cursor: 'pointer',
                          textDecoration: 'none',
                          color: 'var(--foreground)',
                          transition: 'transform 120ms ease, box-shadow 120ms ease, background 120ms ease',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.background = 'var(--card)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.background = 'var(--muted)'; }}
                      >
                        <Icon size="large" style={{ color: 'var(--primary)' }} />
                        <span style={{ fontSize: 11, textAlign: 'center', lineHeight: 1.3 }}>{q.label}</span>
                      </a>
                    );
                  })}
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* 底部：活跃数字员工 */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>我的数字员工</div>
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)', cursor: 'pointer' }} onClick={() => navigate('/dashboard/my-agents')}>管理</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16 }}>
                    <SkeletonBox width="60%" height="14px" style={{ marginBottom: 10 }} />
                    <SkeletonBox width="80%" height="11px" style={{ marginBottom: 8 }} />
                    <SkeletonBox width="40%" height="11px" />
                  </div>
                ))
              : data.activeAgents.map((a, i) => (
                  <div key={i} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16, transition: 'transform 120ms ease, box-shadow 120ms ease' }} onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }} onMouseLeave={(e) => { e.currentTarget.style.transform = ''; }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: 'var(--semi-color-primary-light-default)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600 }}>{a.name.slice(0, 1)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: a.dot_class === 'agent-mini-dot-online' ? 'var(--success)' : 'var(--warning)' }} />
                          <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>{a.type}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 9999, background: a.status_bg, color: a.status_color }}>{a.status_label}</span>
                      <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{a.tasks} 任务</span>
                    </div>
                  </div>
                ))}
          </div>
        </Card>
      </div>

      {/* 消息详情抽屉（工作台最近消息点击） */}
      <SideSheet
        visible={detailMessage != null}
        onCancel={() => setDetailMessage(null)}
        title="消息详情"
        width={480}
      >
        {detailMessage && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--muted)', color: 'var(--muted-foreground)', fontSize: 14, fontWeight: 600, flexShrink: 0,
              }}>
                {detailMessage.sender.slice(0, 1)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{detailMessage.sender}</div>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 2 }}>{detailMessage.time}</div>
              </div>
              <Tag color={detailMessage.unread ? 'red' : 'grey'}>{detailMessage.unread ? '未读' : '已读'}</Tag>
            </div>
            <div>
              <Typography.Title heading={5} style={{ marginBottom: 8 }}>{detailMessage.title}</Typography.Title>
              <Typography.Paragraph style={{ color: 'var(--muted-foreground)' }}>
                {detailMessage.summary}
              </Typography.Paragraph>
            </div>
            {detailMessage.attachments > 0 && (
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <IconPaperclip size="small" /> {detailMessage.attachments} 个附件
              </div>
            )}
          </div>
        )}
      </SideSheet>

      {/* 交付材料抽屉 */}
      <FormDrawer open={deliverablesOpen} title="交付运营材料" onCancel={() => setDeliverablesOpen(false)} footer={null}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {deliverables.length === 0 ? (
            <Typography.Text type="tertiary" style={{ fontSize: 13 }}>暂无交付材料</Typography.Text>
          ) : (
            deliverables.map((d, i) => (
              <Card key={i} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{d.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>{d.type_label} · {d.project} · {d.format} · {d.size} · {d.date}</div>
                  </div>
                  <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 9999, background: 'var(--muted)', color: 'var(--muted-foreground)' }}>{d.gen_name}</span>
                </div>
              </Card>
            ))
          )}
        </div>
      </FormDrawer>

      {/* 创建应用抽屉 */}
      <FormDrawer open={drawerOpen} title="创建应用" onCancel={() => setDrawerOpen(false)} onOk={() => setDrawerOpen(false)}>
        <Field label="应用名称" required>
          <TextInput placeholder="请输入应用名称" />
        </Field>
        <Field label="应用编码">
          <TextInput placeholder="请输入应用编码（如 app-order-mgmt）" />
        </Field>
        <Field label="应用类型">
          <Select defaultValue="业务应用">
            <option value="业务应用">业务应用</option>
            <option value="工具应用">工具应用</option>
            <option value="数据分析">数据分析</option>
            <option value="AI助手">AI助手</option>
          </Select>
        </Field>
        <Field label="描述">
          <TextArea placeholder="请输入应用描述" rows={4} />
        </Field>
        <Field label="图标">
          <Select defaultValue="app">
            <option value="app">应用图标</option>
            <option value="chart">图表图标</option>
            <option value="bot">机器人图标</option>
            <option value="db">数据库图标</option>
            <option value="doc">文档图标</option>
          </Select>
        </Field>
        <Field label="可见范围">
          <Select defaultValue="全公司">
            <option value="全公司">全公司</option>
            <option value="指定组织">指定组织</option>
            <option value="私有">私有</option>
          </Select>
        </Field>
      </FormDrawer>

      {/* 最近任务全量抽屉（懒加载：只在打开时渲染） */}
      {tasksDrawerOpen && (
        <FormDrawer
          open={tasksDrawerOpen}
          title={`最近任务（共 ${(data.recentTasksTotal ?? data.recentTasks.length)} 条）`}
          onCancel={() => setTasksDrawerOpen(false)}
          onOk={() => setTasksDrawerOpen(false)}
          defaultSize="full"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>#</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>任务名</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>类型</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>数字员工</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>状态</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>时间</th>
                </tr>
              </thead>
              <tbody>
                {data.recentTasks.map((t, i) => (
                  <tr key={i}>
                    <td style={{ padding: '10px 12px', color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)', fontSize: 12, borderBottom: '1px solid var(--border)' }}>{i + 1}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, borderBottom: '1px solid var(--border)', fontWeight: 500 }}>{t.name}</td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                      <span className={`v-badge ${t.type_class}`} style={{ borderRadius: 9999, padding: '2px 8px', fontSize: 11, fontWeight: 500, display: 'inline-block' }}>{t.type_label}</span>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 12, borderBottom: '1px solid var(--border)' }}>{t.agent}</td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                      <span className={`v-badge ${t.status_class}`} style={{ borderRadius: 9999, padding: '2px 8px', fontSize: 11, fontWeight: 500, display: 'inline-block' }}>{t.status}</span>
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                      <span className="v-meta">{t.time}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FormDrawer>
      )}
    </PageRoot>
  );
}
