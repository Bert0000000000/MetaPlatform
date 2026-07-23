import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  History, Download, Terminal, Globe, Shield, Bell, Settings2,
  CheckCircle, AlertTriangle, Search, Plus, Pencil, Eye, X,
  KeyRound, ShieldCheck, Gauge, Tag,
  MessageSquare, Mail, Webhook, Send, BellRing,
  ToggleRight, Database, ShieldAlert, Save,
} from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import { useAppTabs } from '@/store/appTabs';
import { FormDrawer } from '@mate/shared';

const APP_SUB_TABS = [
  { label: '应用详情', path: '/apps/detail' },
  { label: '数据建模', path: '/apps/modeling' },
  { label: '表单设计器', path: '/apps/formdesigner' },
  { label: '流程设计器', path: '/apps/processdesigner' },
  { label: '应用配置', path: '/apps/config' },
  { label: '发布管理', path: '/apps/publish' },
  { label: '版本管理', path: '/apps/version' },
];

const CONFIG_NAV = [
  { id: 'env-vars', icon: Terminal, label: '环境变量', badge: '12' },
  { id: 'api-config', icon: Globe, label: 'API 配置', badge: '8' },
  { id: 'permissions', icon: Shield, label: '权限配置', badge: '6' },
  { id: 'notifications', icon: Bell, label: '通知配置', badge: '4' },
  { id: 'advanced', icon: Settings2, label: '高级配置', badge: '3' },
];

// MOCK: 环境变量数据
const ENV_VARS = [
  { key: 'APP_NAME', value: 'order-mgmt-system', env: 'all', type: 'STRING', modified: '2026-07-15 10:00' },
  { key: 'DATABASE_URL', value: 'jdbc:postgresql://pg-17.dev.mate...', env: 'dev', type: 'STRING', modified: '2026-07-22 14:30' },
  { key: 'REDIS_HOST', value: 'redis-cluster.mate.local:6379', env: 'dev', type: 'STRING', modified: '2026-07-20 11:00' },
  { key: 'JWT_SECRET', value: '****', env: 'all', type: 'STRING', modified: '2026-07-19 16:42', encrypted: true },
  { key: 'LLM_MODEL', value: 'doubao-pro-32k', env: 'staging', type: 'STRING', modified: '2026-07-21 09:15' },
  { key: 'LLM_TEMPERATURE', value: '0.7', env: 'all', type: 'NUMBER', modified: '2026-07-18 10:20' },
  { key: 'MAX_TOKENS', value: '4096', env: 'all', type: 'NUMBER', modified: '2026-07-18 10:20' },
  { key: 'ENABLE_RAG', value: 'true', env: 'all', type: 'BOOLEAN', modified: '2026-07-17 15:33' },
  { key: 'MCP_SERVER_URL', value: 'http://mate-mcp:8080/sse', env: 'dev', type: 'STRING', modified: '2026-07-16 09:10' },
  { key: 'NACOS_NAMESPACE', value: 'mate-order-mgmt', env: 'all', type: 'STRING', modified: '2026-07-15 14:22' },
  { key: 'LOG_LEVEL', value: 'DEBUG', env: 'dev', type: 'STRING', modified: '2026-07-18 08:00' },
  { key: 'API_RATE_LIMIT', value: '100', env: 'all', type: 'NUMBER', modified: '2026-07-14 17:50' },
];

const ENV_TAG_STYLES: Record<string, { bg: string; color: string }> = {
  dev: { bg: '#141824', color: '#60a5fa' },
  staging: { bg: '#1a1800', color: 'var(--warning)' },
  prod: { bg: '#14241a', color: 'var(--success)' },
  all: { bg: 'var(--muted)', color: 'var(--muted-foreground)' },
};

// MOCK: 权限矩阵数据
const PERMISSION_ROLES = ['系统管理员', '应用管理员', '开发者', '数据分析师', '只读用户', 'API 调用方'];
const PERMISSION_COLS = ['查看', '编辑', '删除', '发布', '管理', 'API 调用'];
const PERMISSION_MATRIX = [
  [true, true, true, true, true, true],
  [true, true, true, true, true, false],
  [true, true, false, true, false, true],
  [true, false, false, false, false, true],
  [true, false, false, false, false, false],
  [false, false, false, false, false, true],
];

export default function AppConfigPage() {
  const navigate = useNavigate();
  const [activePanel, setActivePanel] = useState('env-vars');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { tabs, activeId } = useAppTabs();
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];
  const appId = active?.id ?? 'order-mgmt';
  const appName = active?.name ?? '订单管理系统';

  return (
    <div>
      <AppHeader appId={appId} appName={appName} subTabs={APP_SUB_TABS} />

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 24 }}>
        <button className="v-btn"><History style={{ width: 14, height: 14 }} />变更历史</button>
        <button className="v-btn"><Download style={{ width: 14, height: 14 }} />导出配置</button>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* Left: Config Nav */}
        <div className="v-card" style={{ width: 200, flexShrink: 0, padding: 12, alignSelf: 'stretch' }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 12px', marginBottom: 8 }}>配置分类</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {CONFIG_NAV.map(item => {
              const NIcon = item.icon;
              const isActive = activePanel === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => setActivePanel(item.id)}
                  style={{
                    height: 36, padding: '0 12px', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', gap: 10,
                    fontSize: 13, cursor: 'pointer', border: '1px solid transparent',
                    ...(isActive ? { background: 'var(--muted)', borderColor: 'var(--border)' } : {}),
                  }}
                >
                  <NIcon style={{ width: 16, height: 16, color: isActive ? 'var(--foreground)' : 'var(--muted-foreground)', flexShrink: 0 }} />
                  <span>{item.label}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, background: 'var(--muted)', color: 'var(--muted-foreground)', padding: '1px 7px', borderRadius: 10, minWidth: 20, textAlign: 'center' }}>{item.badge}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Config Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {activePanel === 'env-vars' && (
            <div>
              {/* Sync Status */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <div className="v-card" style={{ flex: 1, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 'var(--radius)', background: 'var(--success-subtle)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><CheckCircle style={{ width: 18, height: 18 }} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>dev → staging</div>
                    <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>环境变量、API 配置已同步</div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 500, padding: '2px 8px', borderRadius: 10, background: 'var(--success-subtle)', color: 'var(--success)' }}>已同步</span>
                </div>
                <div className="v-card" style={{ flex: 1, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, borderColor: 'rgba(234,179,8,0.3)' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 'var(--radius)', background: 'var(--warning-subtle)', color: 'var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><AlertTriangle style={{ width: 18, height: 18 }} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>staging → prod</div>
                    <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>待同步，2 项配置差异</div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 500, padding: '2px 8px', borderRadius: 10, background: 'var(--warning-subtle)', color: 'var(--warning)' }}>待同步</span>
                </div>
              </div>

              {/* Env Vars Table */}
              <div className="v-card" style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  环境变量
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className="v-meta">12 项</span>
                    <button className="v-btn" style={{ height: 26, fontSize: 12, padding: '0 8px' }} onClick={() => setDrawerOpen(true)}><Plus style={{ width: 12, height: 12 }} />新增变量</button>
                  </div>
                </div>
                {/* Toolbar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                  <div style={{ width: 220, position: 'relative' }}>
                    <Search style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--muted-foreground)' }} />
                    <input className="v-input" placeholder="搜索变量名或值..." style={{ paddingLeft: 30, width: '100%', fontFamily: 'var(--font-mono)', fontSize: 12 }} />
                  </div>
                  <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                    {['All', 'dev', 'staging', 'prod'].map((f, i) => (
                      <button key={f} style={{ height: 28, padding: '0 10px', fontSize: 12, background: i === 0 ? 'var(--muted)' : 'transparent', color: i === 0 ? 'var(--foreground)' : 'var(--muted-foreground)', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', borderRight: i < 3 ? '1px solid var(--border)' : 'none' }}>{f}</button>
                    ))}
                  </div>
                </div>
                {/* Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', width: 200 }}>变量名</th>
                      <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>值</th>
                      <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', width: 80 }}>环境</th>
                      <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', width: 90 }}>类型</th>
                      <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', width: 140 }}>最后修改</th>
                      <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', width: 70 }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ENV_VARS.map((v, i) => {
                      const es = ENV_TAG_STYLES[v.env];
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500 }}>{v.key}</td>
                          <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: 12, ...(v.encrypted ? { color: 'var(--muted-foreground)', letterSpacing: 2 } : {}) }}>{v.value}</td>
                          <td style={{ padding: '8px 12px' }}><span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 500, background: es.bg, color: es.color }}>{v.env}</span></td>
                          <td style={{ padding: '8px 12px' }}><span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 500, fontFamily: 'var(--font-mono)', background: 'var(--muted)', color: 'var(--muted-foreground)' }}>{v.type}</span></td>
                          <td className="v-meta" style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{v.modified}</td>
                          <td style={{ padding: '8px 12px' }}>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button className="v-btn" style={{ height: 26, width: 26, padding: 0, justifyContent: 'center' }}><Pencil style={{ width: 12, height: 12 }} /></button>
                              {v.encrypted && <button className="v-btn" style={{ height: 26, width: 26, padding: 0, justifyContent: 'center' }}><Eye style={{ width: 12, height: 12 }} /></button>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: '1px solid var(--border)', marginTop: 16 }}>
                <button className="v-btn">取消</button>
                <button className="v-btn"><Eye style={{ width: 14, height: 14 }} />预览变更</button>
                <button className="v-btn-primary"><Save style={{ width: 14, height: 14 }} />保存配置</button>
              </div>
            </div>
          )}

          {activePanel === 'api-config' && (
            <div>
              {/* Auth Method */}
              <div className="v-card" style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}><KeyRound style={{ width: 16, height: 16, color: 'var(--muted-foreground)' }} />认证方式</div>
                <div style={{ display: 'flex', gap: 16 }}>
                  {['JWT', 'OAuth2', 'API Key'].map((m, i) => (
                    <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                      <div style={{ width: 16, height: 16, borderRadius: '50%', border: '1.5px solid', borderColor: i === 0 ? 'var(--foreground)' : 'var(--border)', position: 'relative', flexShrink: 0 }}>
                        {i === 0 && <div style={{ position: 'absolute', top: 3, left: 3, width: 8, height: 8, borderRadius: '50%', background: 'var(--foreground)' }} />}
                      </div>
                      <span>{m}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* CORS */}
              <div className="v-card" style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}><ShieldCheck style={{ width: 16, height: 16, color: 'var(--muted-foreground)' }} />CORS 配置</div>
                <p className="v-meta" style={{ marginBottom: 10 }}>允许跨域访问的域名列表</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                  {['https://app.mate-platform.com', 'https://admin.mate-platform.com', 'https://staging.mate-platform.com', 'http://localhost:3000'].map(d => (
                    <div key={d} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input className="v-input" defaultValue={d} style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 12 }} />
                      <button className="v-btn" style={{ height: 26, color: 'var(--destructive)', borderColor: 'rgba(255,97,102,.2)' }}><X style={{ width: 12, height: 12 }} /></button>
                    </div>
                  ))}
                  <button className="v-btn" style={{ height: 26, fontSize: 12, padding: '0 8px' }}><Plus style={{ width: 12, height: 12 }} />添加域名</button>
                </div>
              </div>
              {/* Rate Limiting */}
              <div className="v-card" style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}><Gauge style={{ width: 16, height: 16, color: 'var(--muted-foreground)' }} />速率限制</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                  {[
                    { label: 'QPS 上限', val: '100', desc: '全局每秒最大请求数' },
                    { label: 'Burst', val: '200', desc: '瞬时突发最大请求数' },
                    { label: '单用户 QPS', val: '20', desc: '每用户每秒最大请求数' },
                  ].map(f => (
                    <div key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: 12, color: 'var(--muted-foreground)', fontWeight: 500 }}>{f.label}</label>
                      <input className="v-input" defaultValue={f.val} style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }} />
                      <span style={{ fontSize: 11, color: 'var(--muted-foreground)', opacity: 0.7 }}>{f.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* API Version */}
              <div className="v-card" style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}><Tag style={{ width: 16, height: 16, color: 'var(--muted-foreground)' }} />API 版本管理</div>
                <p className="v-meta" style={{ marginBottom: 4 }}>当前版本：<span style={{ color: 'var(--foreground)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>v3.2.1</span></p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                  {[
                    { tag: '当前', tagBg: 'var(--success-subtle)', tagColor: 'var(--success)', name: 'v3.2.1', desc: 'Spring AI Alibaba 1.1.2 适配 / 新增 A2A 端点', date: '2026-07-20', current: true },
                    { tag: '已废弃', tagBg: 'rgba(255,97,102,.15)', tagColor: 'var(--destructive)', name: 'v3.1.0', desc: 'FastAPI 原始版本，已迁移至 Java', date: '2026-06-15' },
                    { tag: '已废弃', tagBg: 'rgba(255,97,102,.15)', tagColor: 'var(--destructive)', name: 'v3.0.0', desc: '初始版本，基于 Python 技术栈', date: '2026-05-01' },
                  ].map(v => (
                    <div key={v.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: v.current ? 'var(--card)' : 'var(--muted)', borderRadius: 'var(--radius)', border: v.current ? '1px solid var(--border)' : '1px solid transparent' }}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 500, background: v.tagBg, color: v.tagColor, flexShrink: 0 }}>{v.tag}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500 }}>{v.name}</span>
                      <span className="v-meta">{v.desc}</span>
                      <span className="v-meta" style={{ marginLeft: 'auto' }}>{v.date}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: '1px solid var(--border)', marginTop: 16 }}>
                <button className="v-btn">取消</button>
                <button className="v-btn-primary"><Save style={{ width: 14, height: 14 }} />保存配置</button>
              </div>
            </div>
          )}

          {activePanel === 'permissions' && (
            <div>
              <div className="v-card">
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  角色权限矩阵
                  <span className="v-meta">6 个角色 / 6 项权限</span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', width: 140 }}>角色</th>
                      {PERMISSION_COLS.map(c => (
                        <th key={c} style={{ textAlign: 'center', padding: '10px 14px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', width: 70 }}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PERMISSION_ROLES.map((role, ri) => (
                      <tr key={role} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 500 }}>{role}</td>
                        {PERMISSION_MATRIX[ri].map((allowed, ci) => (
                          <td key={ci} style={{ padding: '10px 14px', textAlign: 'center', fontSize: 14 }}>
                            {allowed ? <span style={{ color: 'var(--success)', fontWeight: 600 }}>✓</span> : <span style={{ color: 'var(--muted-foreground)' }}>-</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: '1px solid var(--border)', marginTop: 16 }}>
                <button className="v-btn">取消</button>
                <button className="v-btn-primary"><Save style={{ width: 14, height: 14 }} />保存配置</button>
              </div>
            </div>
          )}

          {activePanel === 'notifications' && (
            <div>
              <div className="v-card" style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>通知渠道</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[
                    { icon: MessageSquare, title: '站内消息', desc: '通过平台内置消息中心推送通知，用户可在通知面板查看历史消息。', on: true },
                    { icon: Mail, title: '邮件通知', desc: '通过 SMTP 服务器发送邮件通知。', on: true, fields: [{ label: 'SMTP 服务器', val: 'smtp.mate-platform.com:465' }] },
                    { icon: Webhook, title: 'Webhook', desc: '向外部服务推送 HTTP 回调通知。', on: false, fields: [{ label: 'Webhook URL', val: '', placeholder: 'https://hooks.example.com/...' }] },
                    { icon: Send, title: '飞书机器人', desc: '通过飞书群机器人 Webhook 推送消息通知。', on: true, fields: [{ label: 'Webhook URL', val: 'https://open.feishu.cn/open-apis/bot/v2/hook/...' }, { label: '加签密钥', val: '****', password: true }] },
                  ].map(ch => {
                    const ChIcon = ch.icon;
                    return (
                      <div key={ch.title} className="v-card" style={{ padding: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}><ChIcon style={{ width: 16, height: 16, color: 'var(--muted-foreground)' }} />{ch.title}</div>
                          <div style={{ width: 36, height: 20, borderRadius: 10, cursor: 'pointer', position: 'relative', flexShrink: 0, border: '1px solid', ...(ch.on ? { background: 'var(--success)', borderColor: 'var(--success)' } : { background: 'var(--muted)', borderColor: 'var(--border)' }) }}>
                            <div style={{ position: 'absolute', top: 2, left: ch.on ? 18 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'all .2s' }} />
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 10, lineHeight: 1.5 }}>{ch.desc}</div>
                        {ch.fields?.map((f: { label: string; val: string; password?: boolean; placeholder?: string }) => (
                          <div key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                            <label style={{ fontSize: 12, color: 'var(--muted-foreground)', fontWeight: 500 }}>{f.label}</label>
                            <input className="v-input" defaultValue={f.val} type={f.password ? 'password' : 'text'} placeholder={f.placeholder ?? ''} style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: 12 }} />
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="v-card" style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}><BellRing style={{ width: 16, height: 16, color: 'var(--muted-foreground)' }} />通知事件</div>
                <p className="v-meta" style={{ marginBottom: 12 }}>选择需要触发通知的事件类型</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {['审批待处理', '任务完成', '系统告警', 'Agent 异常', '数据同步完成', '安全事件', '部署完成'].map(e => (
                    <div key={e} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', padding: '6px 12px', background: 'var(--muted)', border: '1px solid var(--foreground)', borderRadius: 'var(--radius)' }}>
                      <div style={{ width: 16, height: 16, borderRadius: 3, background: 'var(--foreground)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ color: 'var(--background)', fontSize: 10 }}>✓</span>
                      </div>
                      {e}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: '1px solid var(--border)', marginTop: 16 }}>
                <button className="v-btn">取消</button>
                <button className="v-btn-primary"><Save style={{ width: 14, height: 14 }} />保存配置</button>
              </div>
            </div>
          )}

          {activePanel === 'advanced' && (
            <div>
              <div className="v-card" style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}><ToggleRight style={{ width: 16, height: 16, color: 'var(--muted-foreground)' }} />功能开关</div>
                {[
                  { name: '启用审计日志', desc: '记录所有配置变更、数据操作和 API 调用日志', on: true },
                  { name: '启用性能监控', desc: '通过 OpenTelemetry + SAA Graph Observation 采集性能指标', on: true },
                  { name: '启用错误追踪', desc: '自动捕获并上报运行时异常，支持 trace_id 全链路追踪', on: true },
                  { name: '启用 A/B 测试', desc: '支持按用户分桶进行功能灰度验证', on: false },
                  { name: '启用灰度发布', desc: '按比例或用户标签逐步放量新版本', on: true },
                  { name: '启用数据脱敏', desc: '对敏感字段（手机号、身份证等）自动脱敏展示', on: true },
                ].map((t, i, arr) => (
                  <div key={t.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{t.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{t.desc}</div>
                    </div>
                    <div style={{ width: 36, height: 20, borderRadius: 10, cursor: 'pointer', position: 'relative', flexShrink: 0, border: '1px solid', ...(t.on ? { background: 'var(--success)', borderColor: 'var(--success)' } : { background: 'var(--muted)', borderColor: 'var(--border)' }) }}>
                      <div style={{ position: 'absolute', top: 2, left: t.on ? 18 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff' }} />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="v-card">
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}><Database style={{ width: 16, height: 16, color: 'var(--muted-foreground)' }} />缓存策略</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[
                      { label: '缓存类型', val: 'Redis', readonly: true },
                      { label: 'TTL（秒）', val: '300' },
                      { label: '最大缓存条目', val: '10000' },
                    ].map(f => (
                      <div key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: 12, color: 'var(--muted-foreground)', fontWeight: 500 }}>{f.label}</label>
                        <input className="v-input" defaultValue={f.val} readOnly={f.readonly} style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: 12, ...(f.readonly ? { opacity: 0.7 } : {}) }} />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="v-card">
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}><ShieldAlert style={{ width: 16, height: 16, color: 'var(--muted-foreground)' }} />限流策略</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[
                      { label: '全局 QPS', val: '100' },
                      { label: '单用户 QPS', val: '20' },
                      { label: '熔断阈值', val: '50% 错误率' },
                    ].map(f => (
                      <div key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: 12, color: 'var(--muted-foreground)', fontWeight: 500 }}>{f.label}</label>
                        <input className="v-input" defaultValue={f.val} style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: 12 }} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: '1px solid var(--border)', marginTop: 16 }}>
                <button className="v-btn">取消</button>
                <button className="v-btn-primary"><Save style={{ width: 14, height: 14 }} />保存配置</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <FormDrawer
        open={drawerOpen}
        title="新增环境变量"
        onCancel={() => setDrawerOpen(false)}
        onOk={() => setDrawerOpen(false)}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 6 }}>变量名</label>
            <input style={{ width: '100%', height: 36, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0 12px', fontSize: 13, color: 'var(--foreground)', outline: 'none', fontFamily: 'var(--font-mono)' }} placeholder="例如：ENABLE_FEATURE_X" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 6 }}>变量值</label>
            <input style={{ width: '100%', height: 36, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0 12px', fontSize: 13, color: 'var(--foreground)', outline: 'none', fontFamily: 'var(--font-mono)' }} placeholder="请输入变量值" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 6 }}>环境</label>
            <select style={{ width: '100%', height: 36, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0 12px', fontSize: 13, color: 'var(--foreground)', outline: 'none' }}>
              <option>all</option>
              <option>dev</option>
              <option>staging</option>
              <option>prod</option>
            </select>
          </div>
        </div>
      </FormDrawer>
    </div>
  );
}
