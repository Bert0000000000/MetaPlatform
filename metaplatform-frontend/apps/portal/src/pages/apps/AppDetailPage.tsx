import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  CheckCircle, Pencil, Rocket, ArrowDownCircle, Info,
  LayoutList, List, FilePlus, CheckSquare, BarChart3, Truck, Receipt,
  Database, Activity, Download, Copy, ChevronLeft, ChevronRight,
  ShoppingCart, Package, Users, Box, CreditCard, MapPin, Tag,
  FileText, Building2, UserCircle, Briefcase, Folder, Layers,
  GitBranch, Mail, Bell, Calendar, FileBarChart, Settings,
} from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import { useAppTabs } from '@/store/appTabs';

// MOCK: 应用详情下的子 tab（不含应用列表和当前应用名 tab）
const APP_SUB_TABS = [
  { label: '应用详情', path: '/apps/detail' },
  { label: '数据建模', path: '/apps/modeling' },
  { label: '表单设计器', path: '/apps/formdesigner' },
  { label: '流程设计器', path: '/apps/processdesigner' },
  { label: '应用配置', path: '/apps/config' },
  { label: '发布管理', path: '/apps/publish' },
  { label: '版本管理', path: '/apps/version' },
];

// MOCK: 页面列表数据
const PAGES = [
  { name: '订单列表', route: '/orders', icon: List, status: 'active' },
  { name: '创建订单', route: '/orders/create', icon: FilePlus, status: 'active' },
  { name: '审批中心', route: '/orders/approval', icon: CheckSquare, status: 'active' },
  { name: '数据看板', route: '/orders/dashboard', icon: BarChart3, status: 'active' },
  { name: '履约跟踪', route: '/orders/fulfillment', icon: Truck, status: 'active' },
  { name: '结算报表', route: '/orders/settlement', icon: Receipt, status: 'draft' },
  { name: '订单详情', route: '/orders/{id}', icon: FileText, status: 'active' },
  { name: '批量导入', route: '/orders/bulk-import', icon: Layers, status: 'draft' },
  { name: '退货管理', route: '/orders/refunds', icon: Folder, status: 'active' },
  { name: '物流配置', route: '/orders/shipping', icon: MapPin, status: 'active' },
  { name: '评价管理', route: '/orders/reviews', icon: Tag, status: 'active' },
  { name: '通知设置', route: '/orders/notifications', icon: Bell, status: 'draft' },
];

// MOCK: 数据模型
const MODELS = [
  { name: '订单', icon: ShoppingCart, count: '12 字段' },
  { name: '订单项', icon: Package, count: '8 字段' },
  { name: '客户', icon: Users, count: '10 字段' },
  { name: '产品', icon: Box, count: '14 字段' },
  { name: '支付流水', icon: CreditCard, count: '7 字段' },
  { name: '收货地址', icon: MapPin, count: '6 字段' },
  { name: '订单标签', icon: Tag, count: '4 字段' },
  { name: '发票', icon: FileText, count: '9 字段' },
  { name: '组织', icon: Building2, count: '6 字段' },
  { name: '人员', icon: UserCircle, count: '5 字段' },
];

// MOCK: 运营数据
const METRICS = [
  { label: '7日活跃用户', value: '1,284', change: '+12.3% 较上周', type: 'up' },
  { label: '今日 API 调用', value: '8.6K', change: '+5.7% 较昨日', type: 'up' },
  { label: '平均响应时间', value: '126ms', change: '稳定', type: 'neutral' },
  { label: '错误率', value: '0.12%', change: '-0.03% 较上周', type: 'down' },
];

// MOCK: API 接口数据
const APIS = [
  { method: 'GET', path: '/orders', desc: '查询订单列表', calls: '1,247' },
  { method: 'POST', path: '/orders', desc: '创建新订单', calls: '856' },
  { method: 'GET', path: '/orders/{id}', desc: '获取订单详情', calls: '2,103' },
  { method: 'PUT', path: '/orders/{id}', desc: '更新订单信息', calls: '423' },
  { method: 'DELETE', path: '/orders/{id}', desc: '删除订单', calls: '56' },
  { method: 'POST', path: '/orders/{id}/approve', desc: '审批订单', calls: '342' },
  { method: 'GET', path: '/customers', desc: '查询客户列表', calls: '892' },
  { method: 'POST', path: '/customers', desc: '创建客户', calls: '234' },
  { method: 'POST', path: '/orders/{id}/cancel', desc: '取消订单', calls: '178' },
  { method: 'GET', path: '/orders/{id}/status', desc: '查询订单状态', calls: '567' },
];

const METHOD_STYLES: Record<string, { bg: string; color: string }> = {
  GET: { bg: '#14241a', color: 'var(--success)' },
  POST: { bg: '#141824', color: '#60a5fa' },
  PUT: { bg: '#1a1800', color: 'var(--warning)' },
  DELETE: { bg: '#2a1416', color: 'var(--destructive)' },
};

export default function AppDetailPage() {
  const navigate = useNavigate();
  const { tabs, activeId } = useAppTabs();
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];
  const appId = active?.id ?? 'order-mgmt';
  const appName = active?.name ?? '订单管理系统';

  // Pagination for "页面列表" and "数据模型"
  const [pagesPage, setPagesPage] = useState(1);
  const [modelsPage, setModelsPage] = useState(1);
  const PAGE_SIZE = 5;
  const pagesTotalPages = Math.ceil(PAGES.length / PAGE_SIZE);
  const modelsTotalPages = Math.ceil(MODELS.length / PAGE_SIZE);
  const pagedPages = PAGES.slice((pagesPage - 1) * PAGE_SIZE, pagesPage * PAGE_SIZE);
  const pagedModels = MODELS.slice((modelsPage - 1) * PAGE_SIZE, modelsPage * PAGE_SIZE);

  return (
    <div>
      <AppHeader appId={appId} appName={appName} subTabs={APP_SUB_TABS} />

      {/* App Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>订单管理系统</h1>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--muted-foreground)', background: 'var(--muted)', padding: '2px 8px', borderRadius: 4 }}>v2.1</span>
          <span className="v-badge v-badge-success"><CheckCircle style={{ width: 12, height: 12 }} />已发布</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="v-btn"><Pencil style={{ width: 15, height: 15 }} />编辑</button>
          <button className="v-btn"><Rocket style={{ width: 15, height: 15 }} />发布</button>
          <button className="v-btn"><ArrowDownCircle style={{ width: 15, height: 15 }} />下线</button>
        </div>
      </div>

      {/* Basic Info + Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20, alignItems: 'stretch' }}>
        {/* Basic Info Card */}
        <div className="v-card">
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Info style={{ width: 16, height: 16, color: 'var(--muted-foreground)' }} />基本信息
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="v-eyebrow">应用类型</span>
              <span style={{ fontSize: 13 }}>业务应用</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="v-eyebrow">创建者</span>
              <span style={{ fontSize: 13 }}>Admin</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="v-eyebrow">创建时间</span>
              <span style={{ fontSize: 13 }}>2026-06-15 10:30</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="v-eyebrow">修改时间</span>
              <span style={{ fontSize: 13 }}>2026-07-20 09:15</span>
            </div>
            <div style={{ gridColumn: '1/-1', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="v-eyebrow">描述</span>
              <span style={{ fontSize: 13 }}>企业订单全流程管理，覆盖订单创建、审批、履约、结算等核心环节，支持多维度筛选、数据看板与自动报表。</span>
            </div>
            <div style={{ gridColumn: '1/-1', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="v-eyebrow">关联模型</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['订单', '客户', '产品', '订单项'].map(m => (
                  <span key={m} style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: 'var(--muted)', color: 'var(--foreground)' }}>{m}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Metrics */}
        <div className="v-card">
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity style={{ width: 16, height: 16, color: 'var(--muted-foreground)' }} />运营数据
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {METRICS.map(m => (
              <div key={m.label} style={{ padding: 14, background: 'var(--muted)', borderRadius: 'var(--radius)' }}>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 6 }}>{m.label}</div>
                <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>{m.value}</div>
                <div style={{ fontSize: 12, marginTop: 4, color: m.type === 'up' ? 'var(--success)' : m.type === 'down' ? 'var(--destructive)' : 'var(--muted-foreground)' }}>{m.change}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pages / Models Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20, alignItems: 'stretch' }}>
        {/* Pages List */}
        <div className="v-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <LayoutList style={{ width: 16, height: 16, color: 'var(--muted-foreground)' }} />页面列表
              <span style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 400 }}>· {PAGES.length}</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            {pagedPages.map((p, i) => {
              const PIcon = p.icon;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < pagedPages.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 4, background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <PIcon style={{ width: 16, height: 16, color: 'var(--muted-foreground)' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>{p.route}</div>
                  </div>
                  <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, fontWeight: 500, ...(p.status === 'active' ? { background: 'var(--success-subtle)', color: 'var(--success)' } : { background: 'var(--muted)', color: 'var(--muted-foreground)' }) }}>
                    {p.status === 'active' ? '已启用' : '草稿'}
                  </span>
                </div>
              );
            })}
          </div>
          {/* Pages Pagination */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
              第 {(pagesPage - 1) * PAGE_SIZE + 1}–{Math.min(pagesPage * PAGE_SIZE, PAGES.length)} 条 / 共 {PAGES.length} 条
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                onClick={() => setPagesPage((p) => Math.max(1, p - 1))}
                disabled={pagesPage === 1}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: pagesPage === 1 ? 'var(--muted-foreground)' : 'var(--foreground)', cursor: pagesPage === 1 ? 'not-allowed' : 'pointer', opacity: pagesPage === 1 ? 0.5 : 1 }}
              >
                <ChevronLeft style={{ width: 14, height: 14 }} />
              </button>
              <span style={{ fontSize: 12, padding: '0 8px', minWidth: 60, textAlign: 'center' }}>
                {pagesPage} / {pagesTotalPages}
              </span>
              <button
                onClick={() => setPagesPage((p) => Math.min(pagesTotalPages, p + 1))}
                disabled={pagesPage === pagesTotalPages}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: pagesPage === pagesTotalPages ? 'var(--muted-foreground)' : 'var(--foreground)', cursor: pagesPage === pagesTotalPages ? 'not-allowed' : 'pointer', opacity: pagesPage === pagesTotalPages ? 0.5 : 1 }}
              >
                <ChevronRight style={{ width: 14, height: 14 }} />
              </button>
            </div>
          </div>
        </div>

        {/* Data Models */}
        <div className="v-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Database style={{ width: 16, height: 16, color: 'var(--muted-foreground)' }} />数据模型
              <span style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 400 }}>· {MODELS.length}</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            {pagedModels.map((m, i) => {
              const MIcon = m.icon;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < pagedModels.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <MIcon style={{ width: 16, height: 16, color: 'var(--muted-foreground)' }} />
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{m.name}</span>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{m.count}</span>
                </div>
              );
            })}
          </div>
          {/* Models Pagination */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
              第 {(modelsPage - 1) * PAGE_SIZE + 1}–{Math.min(modelsPage * PAGE_SIZE, MODELS.length)} 条 / 共 {MODELS.length} 条
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                onClick={() => setModelsPage((p) => Math.max(1, p - 1))}
                disabled={modelsPage === 1}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: modelsPage === 1 ? 'var(--muted-foreground)' : 'var(--foreground)', cursor: modelsPage === 1 ? 'not-allowed' : 'pointer', opacity: modelsPage === 1 ? 0.5 : 1 }}
              >
                <ChevronLeft style={{ width: 14, height: 14 }} />
              </button>
              <span style={{ fontSize: 12, padding: '0 8px', minWidth: 60, textAlign: 'center' }}>
                {modelsPage} / {modelsTotalPages}
              </span>
              <button
                onClick={() => setModelsPage((p) => Math.min(modelsTotalPages, p + 1))}
                disabled={modelsPage === modelsTotalPages}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: modelsPage === modelsTotalPages ? 'var(--muted-foreground)' : 'var(--foreground)', cursor: modelsPage === modelsTotalPages ? 'not-allowed' : 'pointer', opacity: modelsPage === modelsTotalPages ? 0.5 : 1 }}
              >
                <ChevronRight style={{ width: 14, height: 14 }} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* OpenAPI Panel */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>
        {/* Left: API List */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600 }}>对外 API 接口</h3>
              <span className="v-badge" style={{ background: '#141824', color: '#60a5fa' }}>24 个接口</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="v-btn" style={{ height: 30, fontSize: 12, padding: '0 10px' }}><Download style={{ width: 12, height: 12 }} />导出 OpenAPI</button>
              <button className="v-btn" style={{ height: 30, fontSize: 12, padding: '0 10px' }}><Copy style={{ width: 12, height: 12 }} />复制 Base URL</button>
            </div>
          </div>

          {/* Base URL */}
          <div className="v-card" style={{ marginBottom: 16, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="v-eyebrow" style={{ margin: 0, whiteSpace: 'nowrap' }}>Base URL</span>
            <code style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#60a5fa', background: 'var(--muted)', padding: '4px 8px', borderRadius: 'var(--radius)', flex: 1 }}>https://api.metaplatform.com/v1/order-mgmt</code>
            <span className="v-badge v-badge-success" style={{ fontSize: 11 }}>v3.2.1</span>
          </div>

          {/* API Table */}
          <div className="v-card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 500, color: 'var(--muted-foreground)', fontSize: 12 }}>方法</th>
                  <th style={{ textAlign: 'left', padding: '12px 8px', fontWeight: 500, color: 'var(--muted-foreground)', fontSize: 12 }}>路径</th>
                  <th style={{ textAlign: 'left', padding: '12px 8px', fontWeight: 500, color: 'var(--muted-foreground)', fontSize: 12 }}>描述</th>
                  <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 500, color: 'var(--muted-foreground)', fontSize: 12 }}>调用次数/日</th>
                </tr>
              </thead>
              <tbody>
                {APIS.map((api, i) => {
                  const ms = METHOD_STYLES[api.method];
                  return (
                    <tr key={i} style={{ borderBottom: i < APIS.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ background: ms.bg, color: ms.color, padding: '2px 6px', borderRadius: 'var(--radius)', fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{api.method}</span>
                      </td>
                      <td style={{ padding: '10px 8px', fontFamily: 'var(--font-mono)', fontSize: 12, color: '#60a5fa' }}>{api.path}</td>
                      <td style={{ padding: '10px 8px', color: 'var(--muted-foreground)' }}>{api.desc}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{api.calls}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: API Detail */}
        <div>
          <div className="v-card" style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>接口详情</h3>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ background: '#14241a', color: 'var(--success)', padding: '2px 6px', borderRadius: 'var(--radius)', fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>GET</span>
                <code style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#60a5fa' }}>/orders/{'{id}'}</code>
              </div>
              <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 16 }}>根据订单 ID 获取订单完整信息，包含关联的客户、产品和合同数据。</p>
              <div className="v-eyebrow" style={{ marginBottom: 8 }}>请求参数</div>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}><td style={{ padding: '6px 0', color: 'var(--muted-foreground)', width: 80 }}>id</td><td style={{ padding: '6px 0' }}><span style={{ color: 'var(--warning)' }}>path</span> string</td></tr>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}><td style={{ padding: '6px 0', color: 'var(--muted-foreground)' }}>include</td><td style={{ padding: '6px 0' }}><span style={{ color: '#60a5fa' }}>query</span> string</td></tr>
                  <tr><td style={{ padding: '6px 0', color: 'var(--muted-foreground)' }}>fields</td><td style={{ padding: '6px 0' }}><span style={{ color: '#60a5fa' }}>query</span> string[]</td></tr>
                </tbody>
              </table>
            </div>
            <div className="v-eyebrow" style={{ marginBottom: 8 }}>响应示例</div>
            <div style={{ background: 'var(--muted)', borderRadius: 'var(--radius)', padding: 12, fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.6, color: 'var(--muted-foreground)', overflowX: 'auto', whiteSpace: 'pre' }}>{`{
  "id": "ORD-20260722-001",
  "status": "approved",
  "customer": { "name": "上海XX科技" },
  "items": [...],
  "totalAmount": 128500.00
}`}</div>
          </div>
          <div className="v-card">
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>API 统计</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'GET 接口', val: '14 个' },
                { label: 'POST 接口', val: '7 个' },
                { label: 'PUT 接口', val: '2 个' },
                { label: 'DELETE 接口', val: '1 个' },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--muted-foreground)' }}>{s.label}</span>
                  <span>{s.val}</span>
                </div>
              ))}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600 }}>
                <span>日均调用量</span>
                <span>6,898</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
