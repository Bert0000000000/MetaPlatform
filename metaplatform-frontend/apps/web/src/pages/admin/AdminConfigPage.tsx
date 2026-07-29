/**
 * 系统配置页
 * 数据源：TECH-IAM /api/v1/iam/api-keys, /api/v1/iam/sso-providers
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Plus, RefreshCw, Key, ShieldCheck, Cloud, Copy, Trash2, Pencil,
  CheckCircle2, XCircle, ExternalLink, Sparkles, Wand2, AlertTriangle,
} from 'lucide-react';
import {
  SubTabs, PageLoading, EmptyState, FormDrawer, FormSection, Field, TextInput, TextArea, Select,
  type SubTabItem,
  Api,
} from '@mate/shared';
import type { ApiKeyResponse, SsoProvider } from '@mate/shared/api';
import { SSO_PRESETS, getPresetById, matchPreset, type SsoProviderPreset, type SsoConfigField } from '@mate/shared/api';

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

interface SsoFormState {
  name: string;
  type: SsoProvider['type'];
  clientId: string;
  clientSecret: string;
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userInfoEndpoint: string;
  scopes: string;
  config: Record<string, string>;
  enabled: boolean;
}

const EMPTY_SSO_FORM: SsoFormState = {
  name: '',
  type: 'OIDC',
  clientId: '',
  clientSecret: '',
  issuer: '',
  authorizationEndpoint: '',
  tokenEndpoint: '',
  userInfoEndpoint: '',
  scopes: 'openid profile email',
  config: {},
  enabled: true,
};

function fmtTime(s?: string) { return s ? s.slice(0, 19).replace('T', ' ') : '-'; }
function copy(text: string) { navigator.clipboard?.writeText(text).catch(() => {}); }

/** 根据 preset.id 把端点/scope 填进表单 */
function applyPreset(preset: SsoProviderPreset): SsoFormState {
  return {
    ...EMPTY_SSO_FORM,
    type: preset.type,
    authorizationEndpoint: preset.authorizationEndpoint || '',
    tokenEndpoint: preset.tokenEndpoint || '',
    userInfoEndpoint: preset.userInfoEndpoint || '',
    scopes: preset.scopes || EMPTY_SSO_FORM.scopes,
    name: preset.label,
  };
}

/** 简易 Provider 头像（首字母 + 背景色） */
function ProviderBadge({ preset, size = 28 }: { preset?: SsoProviderPreset; size?: number }) {
  const color = preset?.color || 'var(--muted-foreground)';
  const label = (preset?.brand?.[0] || 'S').toUpperCase();
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: 6,
        background: color,
        color: '#fff',
        fontSize: size <= 28 ? 12 : 14,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  );
}

/** 单个 Config 字段的渲染器 */
function ConfigFieldInput({
  field,
  value,
  onChange,
}: {
  field: SsoConfigField;
  value: string;
  onChange: (v: string) => void;
}) {
  if (field.kind === 'select') {
    return (
      <Select value={value || ''} onChange={(e) => onChange(e.target.value)}>
        <option value="" disabled>请选择</option>
        {field.options?.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </Select>
    );
  }
  if (field.kind === 'textarea') {
    return <TextArea value={value || ''} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />;
  }
  if (field.kind === 'boolean') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 36 }}>
        <button
          type="button"
          onClick={() => onChange(value === 'true' ? 'false' : 'true')}
          style={{ width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', background: value === 'true' ? 'var(--success)' : 'var(--border)', position: 'relative', transition: 'background 0.2s' }}
        >
          <span style={{ position: 'absolute', top: 2, left: 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'transform 0.2s', transform: value === 'true' ? 'translateX(16px)' : 'translateX(0)' }} />
        </button>
        <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>{value === 'true' ? '已启用' : '已禁用'}</span>
      </div>
    );
  }
  if (field.kind === 'password') {
    return <TextInput type="password" value={value || ''} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />;
  }
  return <TextInput type={field.kind === 'number' ? 'number' : 'text'} value={value || ''} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />;
}

export default function AdminConfigPage() {
  const location = useLocation();
  const [tab, setTab] = useState<SubTab>('apikey');
  const [keys, setKeys] = useState<ApiKeyResponse[]>([]);
  const [sso, setSso] = useState<SsoProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingKey, setCreatingKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');

  // SSO CRUD state
  const [ssoFormOpen, setSsoFormOpen] = useState(false);
  const [editingSso, setEditingSso] = useState<SsoProvider | null>(null);
  const [savingSso, setSavingSso] = useState(false);
  const [ssoForm, setSsoForm] = useState<SsoFormState>(EMPTY_SSO_FORM);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');

  // 测试连接状态
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

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

  // === SSO CRUD ===
  const [presetPickerOpen, setPresetPickerOpen] = useState(false);

  const openCreateSso = () => {
    setEditingSso(null);
    setSelectedPresetId('');
    setSsoForm(EMPTY_SSO_FORM);
    setTestResult(null);
    setPresetPickerOpen(true);
  };

  const openEditSso = (p: SsoProvider) => {
    setEditingSso(p);
    const matched = matchPreset(p);
    setSelectedPresetId(matched?.id || '');
    setSsoForm({
      name: p.name,
      type: p.type,
      clientId: p.clientId,
      clientSecret: '',
      issuer: p.issuer ?? '',
      authorizationEndpoint: p.authorizationEndpoint ?? '',
      tokenEndpoint: p.tokenEndpoint ?? '',
      userInfoEndpoint: p.userInfoEndpoint ?? '',
      scopes: p.scopes ?? '',
      config: { ...(p.config || {}) } as Record<string, string>,
      enabled: p.enabled,
    });
    setTestResult(null);
    setSsoFormOpen(true);
  };

  const handlePresetConfirm = () => {
    const preset = getPresetById(selectedPresetId);
    setSsoForm(preset ? applyPreset(preset) : EMPTY_SSO_FORM);
    setPresetPickerOpen(false);
    setSsoFormOpen(true);
  };

  const setConfigField = (key: string, value: string) => {
    setSsoForm((prev) => ({ ...prev, config: { ...prev.config, [key]: value } }));
  };

  const submitSso = async () => {
    if (!ssoForm.name || !ssoForm.clientId) {
      setError('名称和 Client ID 不能为空');
      return;
    }
    setSavingSso(true);
    try {
      const cleanConfig: Record<string, unknown> = {};
      Object.entries(ssoForm.config).forEach(([k, v]) => {
        if (v !== '' && v != null) cleanConfig[k] = v;
      });
      const payload: Record<string, unknown> = {
        name: ssoForm.name,
        type: ssoForm.type,
        clientId: ssoForm.clientId,
        issuer: ssoForm.issuer || undefined,
        authorizationEndpoint: ssoForm.authorizationEndpoint || undefined,
        tokenEndpoint: ssoForm.tokenEndpoint || undefined,
        userInfoEndpoint: ssoForm.userInfoEndpoint || undefined,
        scopes: ssoForm.scopes || undefined,
        enabled: ssoForm.enabled,
        config: Object.keys(cleanConfig).length > 0 ? cleanConfig : undefined,
      };
      if (ssoForm.clientSecret) payload.clientSecret = ssoForm.clientSecret;
      if (editingSso) {
        await Api.updateSsoProvider(editingSso.providerId, payload);
      } else {
        await Api.createSsoProvider({ ...payload, clientSecret: ssoForm.clientSecret });
      }
      setSsoFormOpen(false); setEditingSso(null);
      setSsoForm(EMPTY_SSO_FORM);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSavingSso(false);
    }
  };

  const handleDeleteSso = async (p: SsoProvider) => {
    if (!window.confirm('确定删除 SSO 提供方「' + p.name + '」？')) return;
    try { await Api.deleteSsoProvider(p.providerId); await load(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : '删除失败'); }
  };

  const handleTestConnection = async () => {
    if (!editingSso) {
      setTestResult({ ok: false, message: '请先保存该提供方，再进行测试' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const info = await Api.getSsoAuthorizeUrl(editingSso.providerId);
      if (info.authorizeUrl && /^https?:\/\//i.test(info.authorizeUrl)) {
        setTestResult({
          ok: true,
          message: '端点可达，已生成授权 URL。可在浏览器中打开验证登录跳转。',
        });
      } else {
        setTestResult({ ok: false, message: '后端未返回有效的 authorizeUrl' });
      }
    } catch (e: unknown) {
      setTestResult({ ok: false, message: e instanceof Error ? e.message : '连接失败' });
    } finally {
      setTesting(false);
    }
  };

  const currentPreset = useMemo(() => getPresetById(selectedPresetId), [selectedPresetId]);
  const vendorPresets = SSO_PRESETS.filter((p) => p.vendor);
  const genericPresets = SSO_PRESETS.filter((p) => !p.vendor);

  const configFieldEntries: Array<{ field: SsoConfigField; value: string }> = useMemo(() => {
    const preset = currentPreset;
    const fromPreset = preset?.configFields || [];
    const seen = new Set<string>();
    const result: Array<{ field: SsoConfigField; value: string }> = [];
    for (const f of fromPreset) {
      seen.add(f.key);
      result.push({ field: f, value: ssoForm.config[f.key] ?? '' });
    }
    Object.keys(ssoForm.config).forEach((k) => {
      if (!seen.has(k)) {
        result.push({
          field: { key: k, label: k, kind: 'text', placeholder: '自定义字段' },
          value: ssoForm.config[k] ?? '',
        });
      }
    });
    return result;
  }, [currentPreset, ssoForm.config]);

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
          <>
            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>已配置 {sso.length} 个 SSO 提供方（{sso.filter((p) => p.enabled).length} 个已启用）</span>
              <div style={{ flex: 1 }} />
              <button className="v-btn-primary" onClick={openCreateSso}>
                <Plus style={{ width: 14, height: 14 }} />新建 SSO
              </button>
            </div>

            {/* 厂商快捷入口 */}
            <div className="v-card" style={{ padding: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Sparkles size={14} style={{ color: 'var(--muted-foreground)' }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>中国生态厂商快速接入</span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 12 }}>点击下方厂商卡片，使用预填端点快速创建 SSO 提供方。</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {vendorPresets.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { setSelectedPresetId(p.id); setEditingSso(null); setSsoForm(applyPreset(p)); setTestResult(null); setSsoFormOpen(true); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <ProviderBadge preset={p} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{p.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted-foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {sso.length === 0 ? <EmptyState description="尚未配置 SSO 提供方" /> : (
              <div className="v-card" style={{ overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['厂商', '名称', '类型', 'Client ID', 'Issuer / 端点', '状态', '创建时间', ''].map((h) => (
                        <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sso.map((p) => {
                      const preset = matchPreset(p);
                      const endpointHint = p.authorizationEndpoint || p.issuer || '-';
                      return (
                        <tr key={p.providerId}>
                          <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                            <ProviderBadge preset={preset} size={24} />
                          </td>
                          <td style={{ padding: '10px 12px', fontSize: 13, borderBottom: '1px solid var(--border)' }}>{p.name}</td>
                          <td style={{ padding: '10px 12px', fontSize: 12, borderBottom: '1px solid var(--border)' }}><span className="v-badge v-badge-info">{p.type}</span></td>
                          <td style={{ padding: '10px 12px', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)' }}>{p.clientId}</td>
                          <td style={{ padding: '10px 12px', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--muted-foreground)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }} title={endpointHint}>
                            {preset ? preset.label : (p.authorizationEndpoint ? p.authorizationEndpoint.split('/')[2] : (p.issuer ? p.issuer : '-'))}
                          </td>
                          <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}><span className={p.enabled ? 'v-badge v-badge-success' : 'v-badge v-badge-neutral'}>{p.enabled ? '已启用' : '已禁用'}</span></td>
                          <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)' }}>{fmtTime(p.createdAt)}</td>
                          <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button className="au-action-link" onClick={() => openEditSso(p)} title="编辑"><Pencil style={{ width: 12, height: 12 }} /></button>
                              <button className="au-action-link danger" onClick={() => handleDeleteSso(p)} title="删除"><Trash2 style={{ width: 12, height: 12 }} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
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
                  <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>当前配置：7 day</div>
                </div>
                <span className="v-badge v-badge-info">604800s</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>Audit Log</div>
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

      {/* === SSO Preset 选择器 === */}
      <FormDrawer
        open={presetPickerOpen}
        title="选择 SSO 厂商"
        onCancel={() => setPresetPickerOpen(false)}
        onOk={handlePresetConfirm}
        confirmLoading={false}
        okText="继续"
        cancelText="取消"
      >
        <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 12 }}>选择一个预设模板可以一键填充该厂商的端点与字段。也可选择"自定义"从零开始。</p>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>中国生态厂商</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          {vendorPresets.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedPresetId(p.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 6,
                border: '1px solid ' + (selectedPresetId === p.id ? p.color : 'var(--border)'),
                background: selectedPresetId === p.id ? `${p.color}14` : 'var(--card)',
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              <ProviderBadge preset={p} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{p.label}</div>
                <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{p.type}</div>
              </div>
            </button>
          ))}
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>通用协议</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {genericPresets.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedPresetId(p.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 6,
                border: '1px solid ' + (selectedPresetId === p.id ? p.color : 'var(--border)'),
                background: selectedPresetId === p.id ? `${p.color}14` : 'var(--card)',
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              <ProviderBadge preset={p} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{p.label}</div>
                <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{p.type}</div>
              </div>
            </button>
          ))}
          <button
            onClick={() => setSelectedPresetId('')}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 6,
              border: '1px dashed ' + (selectedPresetId === '' ? 'var(--primary)' : 'var(--border)'),
              background: 'transparent', cursor: 'pointer', textAlign: 'left',
            }}
          >
            <ProviderBadge preset={{ id: 'custom', vendor: false, type: 'OIDC', label: '自定义', brand: '?', description: '', color: 'var(--muted-foreground)' } as SsoProviderPreset} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>自定义</div>
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>从零填写</div>
            </div>
          </button>
        </div>
      </FormDrawer>

      {/* === SSO 配置抽屉 === */}
      <FormDrawer
        open={ssoFormOpen}
        title={editingSso ? '编辑 SSO 提供方' : '新建 SSO 提供方'}
        size="md"
        onCancel={() => { setSsoFormOpen(false); setEditingSso(null); }}
        onOk={submitSso}
        confirmLoading={savingSso}
        okText="保存"
      >
        {currentPreset && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', marginBottom: 16, background: 'var(--muted)', borderRadius: 6 }}>
            <ProviderBadge preset={currentPreset} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{currentPreset.label}（{currentPreset.type}）</div>
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{currentPreset.description}</div>
            </div>
            {currentPreset.helpDocUrl && (
              <a href={currentPreset.helpDocUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--info)', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                配置文档 <ExternalLink size={10} />
              </a>
            )}
          </div>
        )}

        <FormSection title="基本信息">
          <Field label="名称" required>
            <TextInput value={ssoForm.name} onChange={(e) => setSsoForm({ ...ssoForm, name: e.target.value })} placeholder="如：企业微信生产" />
          </Field>
          <Field label="类型" required>
            <Select value={ssoForm.type} onChange={(e) => setSsoForm({ ...ssoForm, type: e.target.value as SsoProvider['type'] })} disabled={!!editingSso}>
              <option value="OIDC">OIDC</option>
              <option value="OAUTH2">OAuth 2.0</option>
              <option value="SAML">SAML</option>
              <option value="LDAP">LDAP</option>
              <option value="CUSTOM">CUSTOM</option>
            </Select>
          </Field>
          <Field label="Client ID" required>
            <TextInput value={ssoForm.clientId} onChange={(e) => setSsoForm({ ...ssoForm, clientId: e.target.value })} placeholder="OAuth Client ID / AppID / CorpID" />
          </Field>
          <Field label="Client Secret" required={!editingSso}>
            <TextInput type="password" value={ssoForm.clientSecret} onChange={(e) => setSsoForm({ ...ssoForm, clientSecret: e.target.value })} placeholder={editingSso ? '留空则不修改' : 'OAuth Client Secret'} />
          </Field>
          <Field label="Issuer / Realm">
            <TextInput value={ssoForm.issuer} onChange={(e) => setSsoForm({ ...ssoForm, issuer: e.target.value })} placeholder={currentPreset?.issuerPlaceholder || '如：https://login.work.weixin.qq.com'} />
          </Field>
          <Field label="启用">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                onClick={() => setSsoForm({ ...ssoForm, enabled: !ssoForm.enabled })}
                style={{ width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', background: ssoForm.enabled ? 'var(--success)' : 'var(--border)', position: 'relative', transition: 'background 0.2s' }}
              >
                <span style={{ position: 'absolute', top: 2, left: 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'transform 0.2s', transform: ssoForm.enabled ? 'translateX(16px)' : 'translateX(0)' }} />
              </button>
              <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>{ssoForm.enabled ? '已启用' : '已禁用'}</span>
            </div>
          </Field>
        </FormSection>

        <FormSection title="OAuth/OIDC 端点" desc={currentPreset ? `已根据「${currentPreset.label}」预填，可手动调整` : 'OIDC 可通过 Issuer 自动发现；OAuth2 / 厂商需手动填写'}>
          <Field label="Authorization Endpoint">
            <TextInput value={ssoForm.authorizationEndpoint} onChange={(e) => setSsoForm({ ...ssoForm, authorizationEndpoint: e.target.value })} placeholder="https://...  /authorize" />
          </Field>
          <Field label="Token Endpoint">
            <TextInput value={ssoForm.tokenEndpoint} onChange={(e) => setSsoForm({ ...ssoForm, tokenEndpoint: e.target.value })} placeholder="https://...  /token" />
          </Field>
          <Field label="UserInfo Endpoint">
            <TextInput value={ssoForm.userInfoEndpoint} onChange={(e) => setSsoForm({ ...ssoForm, userInfoEndpoint: e.target.value })} placeholder="https://...  /userinfo" />
          </Field>
          <Field label="Scopes">
            <TextInput value={ssoForm.scopes} onChange={(e) => setSsoForm({ ...ssoForm, scopes: e.target.value })} placeholder="空格分隔，如：openid profile email" />
          </Field>
        </FormSection>

        {configFieldEntries.length > 0 && (
          <FormSection title={currentPreset ? `${currentPreset.label} 专用配置` : '厂商扩展配置'} desc="保存在 config JSON 字段中，供后端回调逻辑使用">
            {configFieldEntries.map(({ field, value }) => (
              <Field key={field.key} label={field.label} required={field.required}>
                <ConfigFieldInput field={field} value={value} onChange={(v) => setConfigField(field.key, v)} />
                {field.help && (
                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 4 }}>{field.help}</div>
                )}
              </Field>
            ))}
          </FormSection>
        )}

        <FormSection title="测试">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="v-btn"
              onClick={handleTestConnection}
              disabled={testing || !editingSso}
              title={!editingSso ? '请先保存后再测试' : '调用后端 /authorize 生成授权 URL 以验证端点可达'}
            >
              <Wand2 size={14} /> {testing ? '测试中...' : '测试连接'}
            </button>
            {!editingSso && (
              <span style={{ fontSize: 12, color: 'var(--muted-foreground)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <AlertTriangle size={12} />请先保存后测试
              </span>
            )}
          </div>
          {testResult && (
            <div
              style={{
                marginTop: 10,
                padding: '8px 12px',
                borderRadius: 6,
                fontSize: 12,
                background: testResult.ok ? 'rgba(98,209,120,0.08)' : 'rgba(220,38,38,0.08)',
                border: '1px solid ' + (testResult.ok ? 'rgba(98,209,120,0.3)' : 'rgba(220,38,38,0.2)'),
                color: testResult.ok ? 'var(--success)' : 'var(--destructive)',
                display: 'flex', alignItems: 'flex-start', gap: 6,
              }}
            >
              {testResult.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
              <span>{testResult.message}</span>
            </div>
          )}
        </FormSection>
      </FormDrawer>
    </div>
  );
}
