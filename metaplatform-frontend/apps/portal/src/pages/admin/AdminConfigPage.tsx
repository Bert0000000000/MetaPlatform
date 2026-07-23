import { useState } from 'react';
import {
  ShieldCheck, Sparkles, BellRing, HardDrive,
  Settings2, Shield, Mail, Bell, FileText, Wrench,
  Trash2, Plus, Copy, Send,
} from 'lucide-react';
import { SubTabs, type SubTabItem } from '@mate/shared';
import { useLocation } from 'react-router-dom';
import { MOCK_USERS } from '@/mock'; // MOCK

const ADMIN_TABS: SubTabItem[] = [
  { label: '用户管理', path: '/admin' },
  { label: '权限管理', path: '/admin/permissions' },
  { label: '组织管理', path: '/admin/org' },
  { label: '日志管理', path: '/admin/logs' },
  { label: '系统配置', path: '/admin/config' },
  { label: '组件库', path: '/admin/components' },
  { label: '运营数据', path: '/admin/operations' },
];

// MOCK: 配置导航项
const CONFIG_NAV = [
  { id: 'platform', label: '平台设置', icon: Settings2, active: false },
  { id: 'security', label: '安全策略', icon: Shield, active: true },
  { id: 'email', label: '邮件服务', icon: Mail, active: false },
  { id: 'storage', label: '存储配置', icon: HardDrive, active: false },
  { id: 'ai', label: 'AI 配置', icon: Sparkles, active: false },
  { id: 'notification', label: '通知设置', icon: Bell, active: false },
  { id: 'audit', label: '审计设置', icon: FileText, active: false },
  { id: 'advanced', label: '高级设置', icon: Wrench, active: false },
];

export default function AdminConfigPage() {
  const location = useLocation();
  const [activeNav, setActiveNav] = useState('security');

  // Toggle states
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    mfa: true,
    recoveryCode: false,
    rag: true,
    contextCache: true,
    agentAudit: true,
    emailNotify: true,
    inAppNotify: true,
    webhookNotify: true,
  });

  // Checkbox states for password policy
  const [pwdChecks, setPwdChecks] = useState<Record<string, boolean>>({
    upper: true, lower: true, digit: true, special: true,
  });

  // Notification event checkboxes
  const [eventChecks, setEventChecks] = useState<Record<string, boolean>>({
    '审批待处理': true, '任务完成': true, '系统告警': true, 'Agent 异常': true, '数据同步完成': true,
  });

  const toggle = (key: string) => setToggles((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <>
      <SubTabs items={ADMIN_TABS} activePath={location.pathname} />

      <style>{`
        .ac-page-header { margin-bottom: 24px; }
        .ac-page-header h1 { font-size: 22px; font-weight: 600; margin-bottom: 4px; }
        .ac-page-header p { font-size: 14px; color: var(--muted-foreground); }
        .ac-tab-bar { display: flex; gap: 4px; margin-bottom: 24px; border-bottom: 1px solid var(--border); padding-bottom: 12px; }
        .ac-tab-bar .v-tab { cursor: pointer; text-decoration: none; }
        .ac-stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
        .ac-stat-card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px 20px; display: flex; align-items: center; gap: 14px; }
        .ac-stat-icon { width: 40px; height: 40px; border-radius: var(--radius); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .ac-stat-icon svg { width: 20px; height: 20px; }
        .ac-stat-icon.green { background: var(--success-subtle); color: var(--success); }
        .ac-stat-icon.blue { background: #0a1628; color: #3b82f6; }
        .ac-stat-icon.yellow { background: var(--warning-subtle); color: var(--warning); }
        .ac-stat-icon.purple { background: #1a0f28; color: #a78bfa; }
        .ac-stat-info { flex: 1; min-width: 0; }
        .ac-stat-value { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.2; }
        .ac-stat-label { font-size: 12px; color: var(--muted-foreground); margin-top: 2px; }
        .ac-stat-detail { font-size: 11px; color: var(--muted-foreground); margin-top: 4px; }
        .ac-stat-detail span { color: var(--success); font-weight: 500; }
        .ac-config-layout { display: flex; gap: 20px; align-items: flex-start; }
        .ac-config-nav { width: 200px; flex-shrink: 0; }
        .ac-config-nav .v-card { padding: 8px; }
        .ac-config-nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: var(--radius); cursor: pointer; font-size: 13px; color: var(--muted-foreground); transition: background 0.15s, color 0.15s; border: 1px solid transparent; }
        .ac-config-nav-item:hover { background: var(--muted); color: var(--foreground); }
        .ac-config-nav-item.active { background: var(--muted); color: var(--foreground); border-color: var(--border); }
        .ac-config-nav-item svg { width: 16px; height: 16px; flex-shrink: 0; }
        .ac-config-panel { flex: 1; min-width: 0; }
        .ac-form-section { margin-bottom: 28px; }
        .ac-form-section:last-of-type { margin-bottom: 0; }
        .ac-form-section-title { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
        .ac-form-section-desc { font-size: 12px; color: var(--muted-foreground); margin-bottom: 16px; }
        .ac-form-group { margin-bottom: 16px; }
        .ac-form-label { display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px; color: var(--foreground); }
        .ac-form-hint { font-size: 12px; color: var(--muted-foreground); margin-top: 4px; }
        .ac-form-row { display: flex; gap: 16px; align-items: flex-start; }
        .ac-form-row .ac-form-group { flex: 1; }
        .ac-form-input { width: 100%; max-width: 480px; }
        .ac-checkbox-row { display: flex; align-items: center; gap: 8px; font-size: 13px; padding: 4px 0; cursor: pointer; }
        .ac-checkbox-row input[type="checkbox"] { accent-color: var(--foreground); width: 14px; height: 14px; }
        .ac-toggle-row { display: flex; align-items: center; justify-content: space-between; max-width: 480px; padding: 12px 0; border-bottom: 1px solid var(--border); }
        .ac-toggle-row:last-child { border-bottom: none; }
        .ac-toggle-info { flex: 1; }
        .ac-toggle-title { font-size: 13px; font-weight: 500; }
        .ac-toggle-desc { font-size: 12px; color: var(--muted-foreground); margin-top: 2px; }
        .ac-toggle-switch { width: 40px; height: 22px; border-radius: 11px; background: var(--border); cursor: pointer; position: relative; transition: background 0.2s; flex-shrink: 0; }
        .ac-toggle-switch.on { background: var(--success); }
        .ac-toggle-switch::after { content: ''; position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: var(--foreground); transition: transform 0.2s; }
        .ac-toggle-switch.on::after { transform: translateX(18px); }
        .ac-ip-list { max-width: 480px; display: flex; flex-direction: column; gap: 8px; }
        .ac-ip-entry { display: flex; align-items: center; gap: 8px; }
        .ac-ip-entry .v-input { flex: 1; font-family: var(--font-mono); font-size: 12px; }
        .ac-v-btn-sm { height: 28px; padding: 0 10px; font-size: 12px; border-radius: var(--radius); display: inline-flex; align-items: center; gap: 4px; background: transparent; color: var(--foreground); border: 1px solid var(--border); cursor: pointer; font-family: var(--font-sans); }
        .ac-v-btn-sm:hover { background: var(--muted); }
        .ac-v-btn-danger { border-color: var(--destructive); color: var(--destructive); }
        .ac-v-btn-danger:hover { background: rgba(255,97,102,0.1); }
        .ac-save-bar { display: flex; justify-content: flex-end; gap: 12px; margin-top: 28px; padding-top: 20px; border-top: 1px solid var(--border); }
        .ac-v-divider { border: none; border-top: 1px solid var(--border); margin: 24px 0; }
        .ac-event-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; max-width: 480px; }
        .ac-v-select { background: var(--muted); border: 1px solid var(--border); border-radius: var(--radius); color: var(--foreground); font-size: 13px; padding: 8px 30px 8px 12px; outline: none; font-family: var(--font-sans); appearance: none; cursor: pointer; width: 100%; max-width: 480px; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a1a1aa' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; }
      `}</style>
      <div style={{ padding: '24px 0' }}>
        {/* Page Header */}
        <div className="ac-page-header">
          <h1>系统配置</h1>
          <p>平台全局参数配置</p>
        </div>

        {/* Overview stat cards */}
        <div className="ac-stat-grid">
          <div className="ac-stat-card">
            <div className="ac-stat-icon green"><ShieldCheck /></div>
            <div className="ac-stat-info">
              <div className="ac-stat-value">6</div>
              <div className="ac-stat-label">安全策略</div>
              <div className="ac-stat-detail"><span>6 项</span>已配置</div>
            </div>
          </div>
          <div className="ac-stat-card">
            <div className="ac-stat-icon blue"><Sparkles /></div>
            <div className="ac-stat-info">
              <div className="ac-stat-value">3</div>
              <div className="ac-stat-label">AI 服务</div>
              <div className="ac-stat-detail"><span>3 个</span>模型已接入</div>
            </div>
          </div>
          <div className="ac-stat-card">
            <div className="ac-stat-icon yellow"><BellRing /></div>
            <div className="ac-stat-info">
              <div className="ac-stat-value">4</div>
              <div className="ac-stat-label">通知渠道</div>
              <div className="ac-stat-detail"><span>4 个</span>已启用</div>
            </div>
          </div>
          <div className="ac-stat-card">
            <div className="ac-stat-icon purple"><HardDrive /></div>
            <div className="ac-stat-info">
              <div className="ac-stat-value">24%</div>
              <div className="ac-stat-label">存储用量</div>
              <div className="ac-stat-detail">2.4 TB / 10 TB</div>
            </div>
          </div>
        </div>

        <div className="ac-config-layout">
          {/* Config nav */}
          <div className="ac-config-nav">
            <div className="v-card">
              {CONFIG_NAV.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.id}
                    className={`ac-config-nav-item${activeNav === item.id ? ' active' : ''}`}
                    onClick={() => setActiveNav(item.id)}
                  >
                    <Icon /> {item.label}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Config panel */}
          <div className="ac-config-panel">
            {/* 安全策略 */}
            <div className="v-card" style={{ marginBottom: 20 }}>
              <div className="ac-form-section">
                <div className="ac-form-section-title">密码策略</div>
                <div className="ac-form-section-desc">定义用户密码的复杂度要求和有效期规则</div>
                <div className="ac-form-group">
                  <label className="ac-form-label">最小密码长度</label>
                  <div className="ac-form-input">
                    <input className="v-input" type="number" defaultValue={8} min={6} max={32} style={{ width: '100%' }} />
                  </div>
                  <div className="ac-form-hint">建议不低于 8 个字符</div>
                </div>
                <div className="ac-form-group">
                  <label className="ac-form-label">必须包含的字符类型</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 480 }}>
                    {[
                      { key: 'upper', label: '大写字母（A-Z）' },
                      { key: 'lower', label: '小写字母（a-z）' },
                      { key: 'digit', label: '数字（0-9）' },
                      { key: 'special', label: '特殊字符（!@#$%...）' },
                    ].map((c) => (
                      <label key={c.key} className="ac-checkbox-row">
                        <input
                          type="checkbox"
                          checked={pwdChecks[c.key]}
                          onChange={(e) => setPwdChecks((prev) => ({ ...prev, [c.key]: e.target.checked }))}
                        />
                        {c.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <hr className="ac-v-divider" />

              <div className="ac-form-section">
                <div className="ac-form-section-title">登录策略</div>
                <div className="ac-form-section-desc">控制登录安全限制与会话管理</div>
                <div className="ac-form-row">
                  <div className="ac-form-group">
                    <label className="ac-form-label">最大失败次数</label>
                    <div className="ac-form-input">
                      <input className="v-input" type="number" defaultValue={5} min={1} max={20} style={{ width: '100%' }} />
                    </div>
                    <div className="ac-form-hint">连续登录失败达到此次数后锁定账号</div>
                  </div>
                  <div className="ac-form-group">
                    <label className="ac-form-label">锁定时长</label>
                    <div className="ac-form-input" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input className="v-input" type="number" defaultValue={30} min={5} style={{ width: 100 }} />
                      <span className="v-meta">分钟</span>
                    </div>
                    <div className="ac-form-hint">账号锁定后的自动解锁时间</div>
                  </div>
                  <div className="ac-form-group">
                    <label className="ac-form-label">会话超时</label>
                    <div className="ac-form-input" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input className="v-input" type="number" defaultValue={2} min={1} style={{ width: 100 }} />
                      <span className="v-meta">小时</span>
                    </div>
                    <div className="ac-form-hint">无操作超过此时长后自动登出</div>
                  </div>
                </div>
              </div>

              <hr className="ac-v-divider" />

              <div className="ac-form-section">
                <div className="ac-form-section-title">IP 白名单</div>
                <div className="ac-form-section-desc">仅允许以下 IP 地址访问管理后台，留空表示不限制</div>
                <div className="ac-ip-list">
                  {['192.168.1.0/24', '10.0.0.0/8', '172.16.0.0/12'].map((ip, i) => (
                    <div key={i} className="ac-ip-entry">
                      <input className="v-input" type="text" defaultValue={ip} readOnly style={{ flex: 1 }} />
                      <button className="ac-v-btn-sm ac-v-btn-danger"><Trash2 style={{ width: 12, height: 12 }} /></button>
                    </div>
                  ))}
                  <div className="ac-ip-entry">
                    <input className="v-input" type="text" placeholder="输入 IP 地址或 CIDR" style={{ flex: 1 }} />
                    <button className="ac-v-btn-sm"><Plus style={{ width: 12, height: 12 }} />添加</button>
                  </div>
                </div>
              </div>

              <hr className="ac-v-divider" />

              <div className="ac-form-section">
                <div className="ac-form-section-title">多因素认证（MFA）</div>
                <div className="ac-form-section-desc">增强账号安全性，防止未授权访问</div>
                <div className="ac-toggle-row">
                  <div className="ac-toggle-info">
                    <div className="ac-toggle-title">启用 MFA</div>
                    <div className="ac-toggle-desc">强制所有管理员账号启用 TOTP 双因素认证</div>
                  </div>
                  <div className={`ac-toggle-switch${toggles.mfa ? ' on' : ''}`} onClick={() => toggle('mfa')} />
                </div>
                <div className="ac-toggle-row">
                  <div className="ac-toggle-info">
                    <div className="ac-toggle-title">允许恢复码</div>
                    <div className="ac-toggle-desc">生成一次性恢复码，用户丢失设备时可使用恢复码登录</div>
                  </div>
                  <div className={`ac-toggle-switch${toggles.recoveryCode ? ' on' : ''}`} onClick={() => toggle('recoveryCode')} />
                </div>
              </div>
            </div>

            {/* AI 配置 */}
            <div className="v-card" style={{ marginBottom: 20 }}>
              <div className="ac-form-section">
                <div className="ac-form-section-title">AI 配置</div>
                <div className="ac-form-section-desc">配置平台 AI 能力的默认参数与模型选择</div>

                <div className="ac-form-group">
                  <label className="ac-form-label">默认模型</label>
                  <div className="ac-form-input">
                    <select className="ac-v-select">
                      <option value="doubao-pro-32k" selected>doubao-pro-32k</option>
                      <option value="doubao-lite-8k">doubao-lite-8k</option>
                    </select>
                  </div>
                  <div className="ac-form-hint">所有未指定模型的 AI 调用将使用此默认模型</div>
                </div>

                <div className="ac-form-row">
                  <div className="ac-form-group">
                    <label className="ac-form-label">Temperature</label>
                    <div className="ac-form-input" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input className="v-input" type="number" defaultValue={0.7} min={0} max={2} step={0.1} style={{ width: 100 }} />
                    </div>
                    <div className="ac-form-hint">控制输出随机性，0 确定性，2 高随机性</div>
                  </div>
                  <div className="ac-form-group">
                    <label className="ac-form-label">最大 Token 数</label>
                    <div className="ac-form-input" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input className="v-input" type="number" defaultValue={4096} min={256} max={32768} step={256} style={{ width: 120 }} />
                    </div>
                    <div className="ac-form-hint">单次请求的最大输出 Token 数量</div>
                  </div>
                </div>

                <hr className="ac-v-divider" style={{ margin: '20px 0' }} />

                <div className="ac-toggle-row">
                  <div className="ac-toggle-info">
                    <div className="ac-toggle-title">启用 RAG 增强</div>
                    <div className="ac-toggle-desc">在对话中自动检索知识库相关文档，增强回答准确性</div>
                  </div>
                  <div className={`ac-toggle-switch${toggles.rag ? ' on' : ''}`} onClick={() => toggle('rag')} />
                </div>
                <div className="ac-toggle-row">
                  <div className="ac-toggle-info">
                    <div className="ac-toggle-title">启用上下文缓存</div>
                    <div className="ac-toggle-desc">缓存高频上下文片段，降低重复计算的 Token 消耗</div>
                  </div>
                  <div className={`ac-toggle-switch${toggles.contextCache ? ' on' : ''}`} onClick={() => toggle('contextCache')} />
                </div>
                <div className="ac-toggle-row">
                  <div className="ac-toggle-info">
                    <div className="ac-toggle-title">启用 Agent 日志审计</div>
                    <div className="ac-toggle-desc">记录所有 Agent 执行的完整推理链路、工具调用与 Token 用量</div>
                  </div>
                  <div className={`ac-toggle-switch${toggles.agentAudit ? ' on' : ''}`} onClick={() => toggle('agentAudit')} />
                </div>
              </div>
            </div>

            {/* 通知配置 */}
            <div className="v-card" style={{ marginBottom: 20 }}>
              <div className="ac-form-section">
                <div className="ac-form-section-title">通知配置</div>
                <div className="ac-form-section-desc">管理平台事件通知渠道与触发规则</div>

                <div className="ac-toggle-row">
                  <div className="ac-toggle-info">
                    <div className="ac-toggle-title">启用邮件通知</div>
                    <div className="ac-toggle-desc">通过 SMTP 向用户邮箱发送重要事件通知</div>
                  </div>
                  <div className={`ac-toggle-switch${toggles.emailNotify ? ' on' : ''}`} onClick={() => toggle('emailNotify')} />
                </div>
                <div className="ac-toggle-row">
                  <div className="ac-toggle-info">
                    <div className="ac-toggle-title">启用站内消息</div>
                    <div className="ac-toggle-desc">在平台内消息中心推送实时通知</div>
                  </div>
                  <div className={`ac-toggle-switch${toggles.inAppNotify ? ' on' : ''}`} onClick={() => toggle('inAppNotify')} />
                </div>
                <div className="ac-toggle-row">
                  <div className="ac-toggle-info">
                    <div className="ac-toggle-title">启用 Webhook 推送</div>
                    <div className="ac-toggle-desc">将事件以 HTTP POST 方式推送到外部系统</div>
                  </div>
                  <div className={`ac-toggle-switch${toggles.webhookNotify ? ' on' : ''}`} onClick={() => toggle('webhookNotify')} />
                </div>

                <hr className="ac-v-divider" style={{ margin: '20px 0' }} />

                <div className="ac-form-group">
                  <label className="ac-form-label">Webhook URL</label>
                  <div className="ac-form-input" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input className="v-input" type="text" defaultValue="https://hooks.example.com/mate" style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 12 }} />
                    <button className="ac-v-btn-sm"><Copy style={{ width: 12, height: 12 }} /></button>
                    <button className="ac-v-btn-sm"><Send style={{ width: 12, height: 12 }} />测试</button>
                  </div>
                  <div className="ac-form-hint">事件将以 JSON 格式 POST 到此地址，需确保服务端可访问</div>
                </div>

                <hr className="ac-v-divider" style={{ margin: '20px 0' }} />

                <div className="ac-form-group">
                  <label className="ac-form-label">通知事件</label>
                  <div className="ac-form-hint" style={{ marginBottom: 12 }}>选择需要触发通知的业务事件</div>
                  <div className="ac-event-grid">
                    {Object.entries(eventChecks).map(([event, checked]) => (
                      <label key={event} className="ac-checkbox-row">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => setEventChecks((prev) => ({ ...prev, [event]: e.target.checked }))}
                        />
                        {event}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Save / Reset */}
            <div className="ac-save-bar">
              <button className="v-btn">重置默认</button>
              <button className="v-btn-primary">保存配置</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
