import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Plus, Upload, ChevronDown, Search, List, LayoutGrid,
  Eye, Pencil, Rocket, MoreHorizontal, Zap,
  FilePlus, Table2, GitPullRequest, MessageSquare,
  Users, GitBranch, BarChart3, FileSearch, PenTool,
  Warehouse, ShieldCheck, MessageCircleQuestion,
  Briefcase, Database, Sparkles,
} from 'lucide-react';
import { SubTabs } from '@mate/shared';
import { openAppTab } from '@/store/appTabs';
import { MOCK_APPS } from '@/mock'; // MOCK

const APP_TABS = [
  { label: '应用列表', path: '/apps' },
];

// MOCK: 应用列表数据
const APP_ROWS = [
  { id: 'crm', name: '客户管理系统', desc: '企业客户全生命周期管理与画像分析', icon: Users, iconBg: '#0f1a2e', iconColor: '#60a5fa', type: '业务应用', typeIcon: Briefcase, models: 3, status: 'published', version: 'v2.4.1', updatedAt: '2026-07-18 14:30', creator: '张明' },
  { id: 'approval', name: '智能审批流', desc: '基于规则引擎的多级自动化审批工作流', icon: GitBranch, iconBg: '#0f2e1a', iconColor: '#62d178', type: '业务应用', typeIcon: Briefcase, models: 1, status: 'published', version: 'v1.8.0', updatedAt: '2026-07-15 09:22', creator: '李薇' },
  { id: 'dq', name: '数据质量平台', desc: '数据质量监控、规则校验与治理报告', icon: BarChart3, iconBg: '#1a0f2e', iconColor: '#c084fc', type: '数据应用', typeIcon: Database, models: 2, status: 'dev', version: 'v0.9.2', updatedAt: '2026-07-20 16:45', creator: '王浩' },
  { id: 'contract-ai', name: '合同分析 Agent', desc: 'AI 驱动的合同智能审查与风险识别', icon: FileSearch, iconBg: '#2e1a0f', iconColor: '#fb923c', type: 'AI 应用', typeIcon: Sparkles, models: 4, status: 'published', version: 'v3.1.0', updatedAt: '2026-07-12 11:08', creator: '赵琳' },
  { id: 'marketing', name: '营销文案生成器', desc: '多渠道营销内容 AI 自动生成与 A/B 测试', icon: PenTool, iconBg: '#2e0f1a', iconColor: '#f472b6', type: 'AI 应用', typeIcon: Sparkles, models: 2, status: 'dev', version: 'v0.5.0', updatedAt: '2026-07-19 08:55', creator: '陈悦' },
  { id: 'inventory', name: '库存预警系统', desc: '实时库存监控与智能补货预测', icon: Warehouse, iconBg: '#0f2e2e', iconColor: '#22d3ee', type: '数据应用', typeIcon: Database, models: 1, status: 'published', version: 'v1.2.3', updatedAt: '2026-07-10 17:30', creator: '刘强' },
  { id: 'risk-engine', name: '风控决策引擎', desc: '实时风险评估与自动化决策执行', icon: ShieldCheck, iconBg: '#2e0f0f', iconColor: '#f87171', type: '业务应用', typeIcon: Briefcase, models: 5, status: 'published', version: 'v4.0.1', updatedAt: '2026-07-21 10:12', creator: '周鹏' },
  { id: 'kb-qa', name: '知识库问答', desc: '基于 RAG 的企业知识问答与检索增强', icon: MessageCircleQuestion, iconBg: '#2e2a0f', iconColor: '#facc15', type: 'AI 应用', typeIcon: Sparkles, models: 2, status: 'offline', version: 'v1.0.0', updatedAt: '2026-05-10 09:00', creator: '吴磊' },
];

// MOCK: 模板数据
const TEMPLATES = [
  { name: '空白应用', desc: '从零开始构建，完全自定义数据模型、页面与流程', icon: FilePlus },
  { name: 'CRUD 应用', desc: '基于本体模型自动生成增删改查页面与 API 接口', icon: Table2 },
  { name: '审批流应用', desc: '内置 BPMN 审批流程引擎，支持多级审批与条件分支', icon: GitPullRequest },
  { name: 'AI 对话应用', desc: '集成 LLM Gateway，快速搭建 AI 对话与知识检索应用', icon: MessageSquare },
];

const STATUS_MAP: Record<string, { label: string; variant: string }> = {
  published: { label: '已发布', variant: 'v-badge-success' },
  dev: { label: '开发中', variant: 'v-badge-info' },
  offline: { label: '已下线', variant: 'v-badge-destructive' },
};

export default function AppsListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [filterTab, setFilterTab] = useState('全部');
  const [viewMode, setViewMode] = useState<'list' | 'card'>('list');

  const openApp = (app: { id: string; name: string }) => {
    openAppTab({ id: app.id, name: app.name });
    navigate('/apps/detail');
  };

  return (
    <div>
      <SubTabs items={APP_TABS} activePath={location.pathname} />

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 24, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
        <button className="v-btn" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--success-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: 'var(--success)' }}>AI</div>
          <span style={{ fontSize: 13 }}>AI 助手</span>
          <ChevronDown style={{ width: 14, height: 14, color: 'var(--muted-foreground)' }} />
        </button>
        <button className="v-btn"><Upload style={{ width: 16, height: 16 }} />导入应用</button>
        <button className="v-btn-primary"><Plus style={{ width: 16, height: 16 }} />新建应用</button>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: '总应用', value: '24', change: '本月新增', changeVal: '+3', up: true },
          { label: '已发布', value: '18', change: '占比', changeVal: '75%', up: null },
          { label: '开发中', value: '4', change: '待处理', changeVal: '4 项', up: null },
          { label: '已下线', value: '2', change: '本月下线', changeVal: '-1', up: false },
        ].map(s => (
          <div key={s.label} className="v-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="v-eyebrow">{s.label}</span>
            <span className="v-value" style={{ fontSize: 28 }}>{s.value}</span>
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
              {s.change} <span style={{ fontWeight: 600, color: s.up === true ? 'var(--success)' : s.up === false ? 'var(--destructive)' : 'var(--foreground)' }}>{s.changeVal}</span>
            </span>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 2, background: 'var(--muted)', borderRadius: 'var(--radius)', padding: 2 }}>
          {['全部', '已发布', '开发中', '草稿', '已下线'].map((f, i) => (
            <button
              key={f}
              onClick={() => setFilterTab(f)}
              style={{
                padding: '6px 12px', borderRadius: 3, fontSize: 13, cursor: 'pointer',
                color: filterTab === f ? 'var(--foreground)' : 'var(--muted-foreground)',
                background: filterTab === f ? 'var(--card)' : 'transparent',
                border: filterTab === f ? '1px solid var(--border)' : '1px solid transparent',
                fontFamily: 'var(--font-sans)',
              }}
            >
              {f} <span style={{ opacity: 0.5, marginLeft: 2 }}>{[24, 18, 4, 0, 2][i]}</span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <Search style={{ position: 'absolute', left: 10, width: 16, height: 16, color: 'var(--muted-foreground)', pointerEvents: 'none' }} />
            <input className="v-input" type="text" placeholder="搜索应用名称或描述..." style={{ width: 240, paddingLeft: 34 }} />
          </div>
          <div style={{ display: 'flex', gap: 2, background: 'var(--muted)', borderRadius: 'var(--radius)', padding: 2 }}>
            <button
              onClick={() => setViewMode('list')}
              className="v-btn"
              style={{
                width: 32, height: 32, padding: 0, justifyContent: 'center', borderRadius: 3,
                border: viewMode === 'list' ? '1px solid var(--border)' : '1px solid transparent',
                background: viewMode === 'list' ? 'var(--card)' : 'transparent',
                color: viewMode === 'list' ? 'var(--foreground)' : 'var(--muted-foreground)',
              }}
              title="列表视图"
            >
              <List style={{ width: 14, height: 14 }} />
            </button>
            <button
              onClick={() => setViewMode('card')}
              className="v-btn"
              style={{
                width: 32, height: 32, padding: 0, justifyContent: 'center', borderRadius: 3,
                border: viewMode === 'card' ? '1px solid var(--border)' : '1px solid transparent',
                background: viewMode === 'card' ? 'var(--card)' : 'transparent',
                color: viewMode === 'card' ? 'var(--foreground)' : 'var(--muted-foreground)',
              }}
              title="卡片视图"
            >
              <LayoutGrid style={{ width: 14, height: 14 }} />
            </button>
          </div>
        </div>
      </div>

      {/* App List / Card view */}
      {viewMode === 'list' ? (
        <table className="v-table" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 32 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border)', background: 'var(--muted)', minWidth: 260 }}>应用名称</th>
            <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>类型</th>
            <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>模型绑定</th>
            <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>状态</th>
            <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>版本</th>
            <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>更新时间</th>
            <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>创建者</th>
            <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border)', background: 'var(--muted)', minWidth: 200 }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {APP_ROWS.map((app, idx) => {
            const Icon = app.icon;
            const TypeIcon = app.typeIcon;
            const st = STATUS_MAP[app.status];
            return (
              <tr
                key={app.id}
                onClick={() => openApp(app)}
                style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background .15s' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--muted)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <td style={{ padding: '12px 16px', fontSize: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 220 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: app.iconBg, color: app.iconColor }}>
                      <Icon style={{ width: 18, height: 18 }} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 500, lineHeight: 1.3 }}>{app.name}</div>
                      <div className="v-meta">{app.desc}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--muted-foreground)', padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                    <TypeIcon style={{ width: 12, height: 12 }} />{app.type}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13, textAlign: 'center', fontWeight: 500 }}>{app.models}</td>
                <td style={{ padding: '12px 16px', fontSize: 13 }}>
                  <span className={`v-badge ${st.variant}`}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', display: 'inline-block', flexShrink: 0, background: 'currentColor' }} />
                    {st.label}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13 }}>
                  <code className="v-meta" style={{ fontFamily: 'var(--font-mono)', background: 'var(--muted)', padding: '1px 6px', borderRadius: 3 }}>{app.version}</code>
                </td>
                <td className="v-meta" style={{ padding: '12px 16px' }}>{app.updatedAt}</td>
                <td className="v-meta" style={{ padding: '12px 16px' }}>{app.creator}</td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="v-btn" style={{ height: 30, width: 30, padding: 0, justifyContent: 'center' }} title="查看" onClick={() => navigate('/apps/detail')}><Eye style={{ width: 14, height: 14 }} /></button>
                    <button className="v-btn" style={{ height: 30, width: 30, padding: 0, justifyContent: 'center' }} title="编辑" onClick={() => navigate('/apps/formdesigner')}><Pencil style={{ width: 14, height: 14 }} /></button>
                    {app.status !== 'offline' && (
                      <button className="v-btn" style={{ height: 30, width: 30, padding: 0, justifyContent: 'center' }} title="发布" onClick={() => navigate('/apps/publish')}><Rocket style={{ width: 14, height: 14 }} /></button>
                    )}
                    <button className="v-btn" style={{ height: 30, width: 30, padding: 0, justifyContent: 'center' }} title="更多"><MoreHorizontal style={{ width: 14, height: 14 }} /></button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 32 }}>
          {APP_ROWS.map((app, idx) => {
            const Icon = app.icon;
            const st = STATUS_MAP[app.status];
            return (
              <div
              key={app.id}
              onClick={() => openApp(app)}
              style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 20, display: 'flex', flexDirection: 'column', gap: 12, cursor: 'pointer', transition: 'border-color .15s' }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--foreground)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: app.iconBg, color: app.iconColor }}>
                    <Icon style={{ width: 18, height: 18 }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>{app.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>{app.type} · {app.creator}</div>
                  </div>
                  <span className={`v-badge ${st.variant}`}>{st.label}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.6, minHeight: 36 }}>{app.desc}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 11, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' }}>{app.version}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{app.updatedAt}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Templates */}
      <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Zap style={{ width: 18, height: 18, color: 'var(--muted-foreground)' }} />快速创建
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {TEMPLATES.map(t => {
          const TplIcon = t.icon;
          return (
            <div key={t.name} className="v-card" style={{ display: 'flex', flexDirection: 'column', gap: 12, cursor: 'pointer' }}>
              <div style={{ width: 40, height: 40, borderRadius: 'var(--radius)', background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TplIcon style={{ width: 20, height: 20, color: 'var(--muted-foreground)' }} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>{t.name}</div>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.5, flex: 1 }}>{t.desc}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--muted-foreground)', fontWeight: 500 }}>
                使用
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
