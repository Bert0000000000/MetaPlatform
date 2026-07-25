/**
 * 系统配置页
 * 数据源：TECH-IAM /api/v1/iam/api-keys, /api/v1/iam/sso-providers
 */
import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, RefreshCw, Key, ShieldCheck, Cloud, Copy, Trash2 } from 'lucide-react';
import {
  SubTabs, PageLoading, EmptyState, type SubTabItem,
  Api,
} from '@mate/shared';
import type { ApiKeyResponse, SsoProvider } from '@mate/shared/api';

const ADMIN_TABS: SubTabItem[] = [
  { label: '用户管理', path: '/admin' },
  { label: '权限管理', path: '/admin/permissions' },
  { label: '组织管理', path: '/admin/org' },
  { label: '日志管理', path: '/admin/logs' },
  { label: '系统配置', path: '/admin/config' },
  { label: '组件库', path: '/admin/components' },
  { label: '运营数据', path: '/admin/operations' },
];

type SubTab = 'apikey' | 'sso' | 'security';
const TABS: { key: SubTab; label: string; icon: ReactNode }[] = [
  { key: 'apikey',   label: 'API 密钥', icon: <Key size={14} /> },
  { key: 'sso',      label: 'SSO 登录', icon: <Cloud size={14} /> },
  { key: 'security', label: '安全策略', icon: <ShieldCheck size={14} /> },
];

function fmtTime(s?: string) { return s ? s.slice(0, 19).replace('T', ' ') : '-'; }
function copy(text: string) { navigator.clipboard?.writeText(text).catch(() => {}); }

export default function AdminConfigPage() {
  const location = useLocation();
  const [tab, setTab] = useState<SubTab>('apikey');
  const [keys, setKeys] = useState<ApiKeyResponse[]>([]);
  const [sso, setSso] = useState<SsoProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingKey, setCreatingKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [k, s] = await Promise.all([
        Api.listApiKeys({ page: 1, size: 50 }).catch(() => ({ items: [], total: 0 })),
        Api.listSsoProviders({ page: 1, size: 50 }).catch(() => ({ items: [], total: 0 })),
      ]);
      setKeys(k.items);
      setSso(s.items);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const createKey = async () => {
    if (!newKeyName) return;
    setCreatingKey(true);
    try {
      await Api.createApiKey({ name: newKeyName });
      setNewKeyName('');
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '创建失败');
    } finally {
      setCreatingKey(false);
    }
  };

  const revokeKey = async (k: ApiKeyResponse) => {
    if (!window.confirm('确定吊销 API Key「' + k.name + '」？')) return;
    try { await Api.revokeApiKey(k.apiKeyId); await load(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : '吊销失败'); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <SubTabs items={ADMIN_TABS} activePath={location.pathname} />
      <div style={{ padding: '24px 0', flex: 1, minHeight: 0, overflow: 'auto' }}>
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>系统配置</h1>
          <p style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>管理 API 密钥、SSO 登录与安全策略（数据源：TECH-IAM）</p>
        </div>

        {error && (
          <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 6, fontSize: 13, color: 'var(--destructive)' }}>
            {error} <button onClick={() => setError(null)} style={{ float: 'right', background: 'none', border: 'none', color: 'var(--destructive)', cursor: 'pointer' }}>×</button>
          </div>
        )}

        <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '8px 16px', border: 'none', background: 'none', borderBottom: tab === t.key ? '2px solid var(--primary)' : '2px solid transparent', color: tab === t.key ? 'var(--foreground)' : 'var(--muted-foreground)', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
              {t.icon} {t.label}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button className="v-btn" onClick={load} title="刷新"><RefreshCw style={{ width: 14, height: 14 }} /></button>
        </div>

        {loading ? <PageLoading /> : tab === 'apikey' ? (
          <>
            <div className="v-card" style={{ padding: 16, marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}><Plus style={{ width: 14, height: 14, display: 'inline', marginRight: 4 }} />新建 API Key</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="v-input" style={{ flex: 1, height: 32 }} placeholder="Key 名称（如：CI Pipeline）" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} />
                <button className="v-btn-primary" onClick={createKey} disabled={!newKeyName || creatingKey}>{creatingKey ? '创建中...' : '创建'}</button>
              </div>
              <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 8 }}>提示：创建后请立即保存返回的密钥。出于安全原因，密钥只显示一次。</p>
            </div>

            {keys.length === 0 ? <EmptyState description="尚未创建 API Key" /> : (
              <div className="v-card" style={{ overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['名称', '前缀', '状态', '最后使用', '创建时间', '操作'].map((h) => (
                        <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {keys.map((k) => (
                      <tr key={k.apiKeyId}>
                        <td style={{ padding: '10px 12px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>{k.name}</td>
                        <td style={{ padding: '10px 12px', fontSize: 12, fontFamily: 'var(--font-mono)', borderBottom: '1px solid var(--border)' }}>
                          {k.prefix ? (<><span>{k.prefix}...</span><button className="au-action-link" onClick={() => copy(k.prefix ?? '')} title="复制"><Copy size={12} style={{ display: 'inline' }} /></button></>) : '-'}
                        </td>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}><span className={k.status === 'ACTIVE' ? 'v-badge v-badge-success' : 'v-badge v-badge-error'}>{k.status}</span></td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)' }}>{fmtTime(k.lastUsedAt)}</td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)' }}>{fmtTime(k.createdAt)}</td>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                          {k.status === 'ACTIVE' && <button className="au-action-link danger" onClick={() => revokeKey(k)}><Trash2 size={12} style={{ display: 'inline' }} />吊销</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : tab === 'sso' ? (
          sso.length === 0 ? <EmptyState description="尚未配置 SSO 提供方" /> : (
            <div className="v-card" style={{ overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['名称', '类型', 'Client ID', '状态', '创建时间'].map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sso.map((p) => (
                    <tr key={p.providerId}>
                      <td style={{ padding: '10px 12px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>{p.name}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, borderBottom: '1px solid var(--border)' }}><span className="v-badge v-badge-info">{p.type}</span></td>
                      <td style={{ padding: '10px 12px', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)' }}>{p.clientId}</td>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}><span className={p.enabled ? 'v-badge v-badge-success' : 'v-badge v-badge-neutral'}>{p.enabled ? '已启用' : '已禁用'}</span></td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)' }}>{fmtTime(p.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div className="v-card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>安全策略</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>密码复杂度</div>
                  <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>至少 8 位，包含大写/小写/数字/特殊字符中 3 类</div>
                </div>
                <span className="v-badge v-badge-success">已启用</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>登录失败锁定</div>
                  <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>连续 5 次失败后锁定账号 30 分钟</div>
                </div>
                <span className="v-badge v-badge-success">已启用</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>JWT Access Token 有效期</div>
                  <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>当前配置：2 小时</div>
                </div>
                <span className="v-badge v-badge-info">7200s</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>JWT Refresh Token 有效期</div>
                  <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>当前配置：7 天</div>
                </div>
                <span className="v-badge v-badge-info">604800s</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>审计日志</div>
                  <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>记录所有用户操作与状态变更</div>
                </div>
                <span className="v-badge v-badge-success">已启用</span>
              </div>
            </div>
            <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 20, padding: '8px 12px', background: 'var(--muted)', borderRadius: 4 }}>
              提示：安全策略当前通过 TECH-IAM application-dev.yml 配置，UI 修改需要重启服务并写入 Nacos Config。详细参见 docs/INTEGRATION-MODULE-IAM-ADMIN.md。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}