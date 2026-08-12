import { useLocation } from 'react-router-dom';
import { Card } from '@douyinfe/semi-ui';
import { Button } from '@douyinfe/semi-ui';
import { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Plus,
  Bookmark,
  LayoutGrid,
  Clock,
  Calendar,
  MousePointerClick,
  ShoppingBag,
  Users,
  TrendingUp,
  Headphones,
  ListChecks,
  TriangleAlert,
  BookOpen,
  Building2,
  FileText,
  ShieldCheck,
  Activity,
  type LucideIcon,
} from 'lucide-react';
import { FormDrawer, Field, TextInput, TextArea, Select } from '@mate/shared';
import { getMyApps, type MyAppItem } from '@/api/dashboard/workbench';


// API icon 字符串 → lucide 组件
const APP_ICON_MAP: Record<string, LucideIcon> = {
  ShoppingBag, Users, TrendingUp, Headphones, ListChecks,
  TriangleAlert, BookOpen, Building2, FileText, ShieldCheck, Activity,
};
const getAppIcon = (name: string): LucideIcon => APP_ICON_MAP[name] ?? FileText;

const typeBadgeStyle = (type: string): React.CSSProperties => {
  if (type === 'business') return { color: '#60a5fa', borderColor: '#1e3a5f', background: '#0c1929' };
  if (type === 'data') return { color: '#62d178', borderColor: '#1e4d2b', background: '#0c1f13' };
  return { color: '#c084fc', borderColor: '#3b1f5e', background: '#1a0e2e' };
};
const FALLBACK_APPS: MyAppItem[] = [
  { name: '订单管理系统', type: 'business', type_label: '业务', description: '全流程订单管理，从创建、审核到履约跟踪', last_used: '3 分钟前', date: null, usage: null, icon: 'ShoppingBag', pinned: true },
  { name: '客户 CRM', type: 'business', type_label: '业务', description: '统一管理客户信息、跟进记录与销售线索', last_used: '15 分钟前', date: null, usage: null, icon: 'Users', pinned: true },
  { name: '供应链看板', type: 'data', type_label: '数据', description: '端到端供应链可视化', last_used: '1 小时前', date: null, usage: null, icon: 'TrendingUp', pinned: true },
  { name: '智能客服', type: 'ai', type_label: 'AI', description: '基于 RAG 的多轮对话客服', last_used: '2 小时前', date: null, usage: null, icon: 'Headphones', pinned: true },
  { name: '智能审批流', type: 'business', type_label: '业务', description: '基于规则的自动化审批流程', last_used: null, date: '2026-06-10', usage: '328 次', icon: 'ListChecks', pinned: false },
  { name: '数据质量监控', type: 'data', type_label: '数据', description: '实时检测数据异常', last_used: null, date: '2026-06-18', usage: '156 次', icon: 'TriangleAlert', pinned: false },
  { name: '知识库检索', type: 'ai', type_label: 'AI', description: '基于向量语义的知识库检索', last_used: null, date: '2026-05-22', usage: '892 次', icon: 'BookOpen', pinned: false },
  { name: '供应商评估', type: 'data', type_label: '数据', description: '多维度供应商打分评估', last_used: null, date: '2026-07-01', usage: '74 次', icon: 'Building2', pinned: false },
  { name: '合同分析助手', type: 'ai', type_label: 'AI', description: 'AI 驱动的合同条款解析', last_used: null, date: '2026-07-08', usage: '213 次', icon: 'FileText', pinned: false },
  { name: '风险预警平台', type: 'business', type_label: '业务', description: '实时监控业务风险指标', last_used: null, date: '2026-07-14', usage: '447 次', icon: 'TriangleAlert', pinned: false },
];


const appCardStyle: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  padding: 18,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  cursor: 'pointer',
};

// 简单骨架占位
const SkeletonLine: React.FC<{ width?: string; height?: string; style?: React.CSSProperties }> = ({ width = '100%', height = '14px', style }) => (
  <div
    style={{
      width, height,
      background: 'linear-gradient(90deg, var(--muted) 0%, var(--border) 50%, var(--muted) 100%)',
      backgroundSize: '200% 100%',
      animation: 'workbench-shimmer 1.4s ease-in-out infinite',
      borderRadius: 4, ...style,
    }}
  />
);

export default function MyAppsPage() {
    const [drawerOpen, setDrawerOpen] = useState(false);

  // 数据状态
  const [apps, setApps] = useState<MyAppItem[]>(FALLBACK_APPS);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'api' | 'fallback'>('fallback');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getMyApps()
      .then((res) => {
        if (cancelled) return;
        setApps(res);
        setSource('api');
      })
      .catch(() => {
        if (cancelled) return;
        setSource('fallback');
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // 派生数据：常用（pinned=true）和全部（pinned=false）
  const pinnedApps = useMemo(() => apps.filter(a => a.pinned), [apps]);
  const allApps = useMemo(() => apps.filter(a => !a.pinned), [apps]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

      <div style={{ padding: '24px 0', flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4, letterSpacing: '-0.01em' }}>我的应用</h1>
            <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>管理并快速访问你有权限的所有应用</p>
          </div>
          {source === 'fallback' && !loading && (
            <span title="API 不可达，使用本地兜底数据" style={{ fontSize: 10, padding: '1px 6px', borderRadius: 9999, background: 'var(--warning-subtle)', color: 'var(--warning)' }}>本地数据</span>
          )}
        </div>

        {/* Search + filter bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
            <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'var(--muted-foreground)', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="搜索应用名称或描述..."
              style={{ width: '100%', height: 36, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, padding: '0 16px 0 40px', fontSize: 13, color: 'var(--foreground)', fontFamily: 'var(--font-sans)', outline: 'none' }}
            />
          </div>
          <select style={{ height: 36, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, padding: '0 32px 0 12px', fontSize: 13, color: 'var(--foreground)', fontFamily: 'var(--font-sans)', outline: 'none', cursor: 'pointer', appearance: 'none' }}>
            <option value="all">全部类型</option>
            <option value="business">业务应用</option>
            <option value="data">数据应用</option>
            <option value="ai">AI 应用</option>
          </select>
          <select style={{ height: 36, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, padding: '0 32px 0 12px', fontSize: 13, color: 'var(--foreground)', fontFamily: 'var(--font-sans)', outline: 'none', cursor: 'pointer', appearance: 'none' }}>
            <option value="recent">最近使用</option>
            <option value="name">名称排序</option>
            <option value="created">创建时间</option>
          </select>
          <div style={{ flex: 1 }} />
          <Button theme="solid" type="primary" style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }} onClick={() => setDrawerOpen(true)}>
            <Plus style={{ width: 15, height: 15 }} />新建应用
          </Button>
        </div>

        {/* Pinned apps */}
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Bookmark style={{ width: 16, height: 16, color: 'var(--muted-foreground)' }} />
          常用应用
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 36 }}>
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} style={appCardStyle} >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <SkeletonLine width="36px" height="36px" style={{ borderRadius: 4 }} />
                    <div style={{ flex: 1 }}>
                      <SkeletonLine width="40%" height="14px" style={{ marginBottom: 8 }} />
                      <SkeletonLine width="25%" height="16px" style={{ borderRadius: 4 }} />
                    </div>
                  </div>
                  <SkeletonLine width="90%" height="12px" style={{ marginBottom: 4 }} />
                  <SkeletonLine width="70%" height="12px" style={{ marginBottom: 12 }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <SkeletonLine width="40%" height="12px" />
                    <SkeletonLine width="50px" height="28px" style={{ borderRadius: 4 }} />
                  </div>
                </Card>
              ))
            : pinnedApps.length === 0
              ? <div style={{ gridColumn: 'span 2', padding: 24, color: 'var(--muted-foreground)', fontSize: 13, textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 4 }}>暂无常用应用</div>
              : pinnedApps.map((app, i) => {
                  const Icon = getAppIcon(app.icon);
                  return (
                    <Card key={app.name + i} style={appCardStyle} >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 4, background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--muted-foreground)' }}>
                          <Icon style={{ width: 18, height: 18 }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{app.name}</div>
                          <span style={{ display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 8px', borderRadius: 4, fontSize: 11, fontWeight: 500, border: '1px solid var(--border)', marginTop: 4, ...typeBadgeStyle(app.type) }}>{app.type_label}</span>
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{app.description}</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock style={{ width: 13, height: 13 }} />
                          最近使用: {app.last_used}
                        </span>
                        <button style={{ height: 28, padding: '0 14px', background: 'var(--primary)', color: 'var(--primary-foreground)', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>打开</button>
                      </div>
                    </Card>
                  );
                })}
        </div>

        {/* All apps */}
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          <LayoutGrid style={{ width: 16, height: 16, color: 'var(--muted-foreground)' }} />
          全部应用
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} style={appCardStyle} >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <SkeletonLine width="36px" height="36px" style={{ borderRadius: 4 }} />
                    <div style={{ flex: 1 }}>
                      <SkeletonLine width="40%" height="14px" style={{ marginBottom: 8 }} />
                      <SkeletonLine width="25%" height="16px" style={{ borderRadius: 4 }} />
                    </div>
                  </div>
                  <SkeletonLine width="90%" height="12px" style={{ marginBottom: 4 }} />
                  <SkeletonLine width="70%" height="12px" style={{ marginBottom: 12 }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <SkeletonLine width="40%" height="12px" />
                    <SkeletonLine width="50px" height="28px" style={{ borderRadius: 4 }} />
                  </div>
                </Card>
              ))
            : allApps.length === 0
              ? <div style={{ gridColumn: 'span 2', padding: 24, color: 'var(--muted-foreground)', fontSize: 13, textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 4 }}>暂无应用</div>
              : allApps.map((app, i) => {
                  const Icon = getAppIcon(app.icon);
                  return (
                    <Card key={app.name + i} style={appCardStyle} >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 4, background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--muted-foreground)' }}>
                          <Icon style={{ width: 18, height: 18 }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{app.name}</div>
                          <span style={{ display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 8px', borderRadius: 4, fontSize: 11, fontWeight: 500, border: '1px solid var(--border)', marginTop: 4, ...typeBadgeStyle(app.type) }}>{app.type_label}</span>
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{app.description}</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: 'var(--muted-foreground)' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Calendar style={{ width: 13, height: 13 }} />
                            {app.date}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <MousePointerClick style={{ width: 13, height: 13 }} />
                            {app.usage}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button style={{ height: 28, padding: '0 12px', background: 'transparent', color: 'var(--foreground)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 12, fontFamily: 'var(--font-sans)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                            打开
                          </button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
        </div>
      </div>

      <FormDrawer open={drawerOpen} title="新建应用" onCancel={() => setDrawerOpen(false)} onOk={() => setDrawerOpen(false)}>
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
            <option value="app">📦 应用图标</option>
            <option value="chart">📊 图表图标</option>
            <option value="bot">🤖 机器人图标</option>
            <option value="db">🗄️ 数据库图标</option>
            <option value="doc">📄 文档图标</option>
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
    </div>
  );
}