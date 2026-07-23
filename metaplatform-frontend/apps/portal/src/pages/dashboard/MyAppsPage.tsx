import { useLocation } from 'react-router-dom';
import { useState } from 'react';
import {
  Search,
  Plus,
  Bookmark,
  LayoutGrid,
  ShoppingBag,
  Users,
  TrendingUp,
  Headphones,
  ListChecks,
  TriangleAlert,
  BookOpen,
  Building2,
  FileText,
  Calendar,
  MousePointerClick,
  Clock,
} from 'lucide-react';
import { SubTabs, FormDrawer, Field, TextInput, TextArea, Select } from '@mate/shared';

const DASHBOARD_TABS = [
  { label: '工作台', path: '/dashboard' },
  { label: '我的应用', path: '/dashboard/my-apps' },
  { label: '我的数字员工', path: '/dashboard/my-agents' },
  { label: '消息', path: '/dashboard/messages' },
  { label: '门户', path: '/dashboard/portal' },
  { label: '交付材料', path: '/dashboard/deliverables' },
];

// MOCK: pinned apps
const pinnedApps = [
  { name: '订单管理系统', type: 'business', typeLabel: '业务', desc: '全流程订单管理，从创建、审批到履约跟踪，支持多渠道订单聚合与异常处理', lastUsed: '3分钟前', icon: ShoppingBag },
  { name: '客户CRM', type: 'business', typeLabel: '业务', desc: '统一管理客户信息、跟进记录与销售线索，AI 自动打标与流失预警', lastUsed: '15分钟前', icon: Users },
  { name: '供应链看板', type: 'data', typeLabel: '数据', desc: '端到端供应链可视化，实时追踪库存、物流与供应商交付状态', lastUsed: '1小时前', icon: TrendingUp },
  { name: '智能客服', type: 'ai', typeLabel: 'AI', desc: '基于 RAG 的多轮对话客服，支持知识库检索、工单自动创建与人工转接', lastUsed: '2小时前', icon: Headphones },
];

// MOCK: all apps
const allApps = [
  { name: '智能审批流', type: 'business', typeLabel: '业务', desc: '基于规则的自动化审批流程，支持多级会签与条件分支', date: '2026-06-10', usage: '328 次', icon: ListChecks },
  { name: '数据质量监控', type: 'data', typeLabel: '数据', desc: '实时检测数据异常，自动生成质量评分与修复建议', date: '2026-06-18', usage: '156 次', icon: TriangleAlert },
  { name: '知识库检索', type: 'ai', typeLabel: 'AI', desc: '基于向量语义的企业知识库智能检索与问答', date: '2026-05-22', usage: '892 次', icon: BookOpen },
  { name: '供应商评估', type: 'data', typeLabel: '数据', desc: '多维度供应商打分评估，自动生成排名与建议报告', date: '2026-07-01', usage: '74 次', icon: Building2 },
  { name: '合同分析助手', type: 'ai', typeLabel: 'AI', desc: 'AI 驱动的合同条款智能解析与风险标注', date: '2026-07-08', usage: '213 次', icon: FileText },
  { name: '风险预警平台', type: 'business', typeLabel: '业务', desc: '实时监控业务风险指标，自动触发预警与通知', date: '2026-07-14', usage: '447 次', icon: TriangleAlert },
];

const typeBadgeStyle = (type: string): React.CSSProperties => {
  if (type === 'business') return { color: '#60a5fa', borderColor: '#1e3a5f', background: '#0c1929' };
  if (type === 'data') return { color: '#62d178', borderColor: '#1e4d2b', background: '#0c1f13' };
  return { color: '#c084fc', borderColor: '#3b1f5e', background: '#1a0e2e' };
};

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

export default function MyAppsPage() {
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <SubTabs items={DASHBOARD_TABS} activePath={location.pathname} />

      <div style={{ padding: '24px 0', flex: 1, minHeight: 0, overflowY: 'auto' }}>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4, letterSpacing: '-0.01em' }}>我的应用</h1>
        <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>管理并快速访问你有权限的所有应用</p>
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
        <button className="v-btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }} onClick={() => setDrawerOpen(true)}>
          <Plus style={{ width: 15, height: 15 }} />新建应用
        </button>
      </div>

      {/* Pinned apps */}
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Bookmark style={{ width: 16, height: 16, color: 'var(--muted-foreground)' }} />
        常用应用
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 36 }}>
        {pinnedApps.map((app, i) => {
          const Icon = app.icon;
          return (
            <div key={i} style={appCardStyle} className="v-card">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 4, background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--muted-foreground)' }}>
                  <Icon style={{ width: 18, height: 18 }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{app.name}</div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 8px', borderRadius: 4, fontSize: 11, fontWeight: 500, border: '1px solid var(--border)', marginTop: 4, ...typeBadgeStyle(app.type) }}>{app.typeLabel}</span>
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{app.desc}</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock style={{ width: 13, height: 13 }} />
                  最近使用: {app.lastUsed}
                </span>
                <button style={{ height: 28, padding: '0 14px', background: 'var(--primary)', color: 'var(--primary-foreground)', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>打开</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* All apps */}
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
        <LayoutGrid style={{ width: 16, height: 16, color: 'var(--muted-foreground)' }} />
        全部应用
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {allApps.map((app, i) => {
          const Icon = app.icon;
          return (
            <div key={i} style={appCardStyle} className="v-card">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 4, background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--muted-foreground)' }}>
                  <Icon style={{ width: 18, height: 18 }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{app.name}</div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 8px', borderRadius: 4, fontSize: 11, fontWeight: 500, border: '1px solid var(--border)', marginTop: 4, ...typeBadgeStyle(app.type) }}>{app.typeLabel}</span>
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{app.desc}</div>
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
            </div>
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
