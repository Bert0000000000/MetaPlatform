import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth, Api, MateBrand, type AuthUser } from '@mate/shared';
import { matchPreset, type SsoProvider } from '@mate/shared/api';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('Admin@12345');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ssoProviders, setSsoProviders] = useState<SsoProvider[]>([]);
  const [ssoLoading, setSsoLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // 拉取已启用的 SSO 提供方
    Api.listEnabledSsoProviders().then(setSsoProviders).catch(() => setSsoProviders([]));
  }, []);

  const handleLogin = async () => {
    if (!username || !password) {
      setError('请输入用户名和密码');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const resp = await Api.login({ username, password, tenantId: 'tenant-default' });
      const authedUser: AuthUser = {
        id: resp.userId ?? resp.user?.id ?? '',
        username: resp.username ?? resp.user?.username ?? username,
        tenantId: 'tenant-default',
        realName: resp.realName ?? resp.user?.realName,
        email: resp.user?.email,
        roles: ['USER'],
      };
      login(authedUser, resp.accessToken, resp.refreshToken);
      navigate('/dashboard');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '登录失败，请重试';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleLogin();
  };

  /** 触发 SSO 跳转：拉取后端生成的 authorizeUrl 然后跳转 */
  const handleSsoLogin = async (p: SsoProvider) => {
    setSsoLoading((m) => ({ ...m, [p.providerId]: true }));
    setError(null);
    try {
      const info = await Api.getSsoAuthorizeUrl(p.providerId, window.location.origin + '/sso/callback');
      // 把 state 暂存到 sessionStorage，回调时校验
      try { sessionStorage.setItem('sso_state', info.state); sessionStorage.setItem('sso_provider', p.providerId); } catch {}
      window.location.href = info.authorizeUrl;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '发起 SSO 登录失败';
      setError(msg);
      setSsoLoading((m) => ({ ...m, [p.providerId]: false }));
    }
  };

  // 检测当前 URL 是否包含 SSO 回调参数，自动处理
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    if (code && state) {
      const providerId = sessionStorage.getItem('sso_provider');
      const expectedState = sessionStorage.getItem('sso_state');
      if (!providerId) return;
      if (expectedState && expectedState !== state) {
        setError('SSO state 校验失败，请重新登录');
        return;
      }
      setError(null);
      setLoading(true);
      if (!providerId) {
        setError('SSO 回调缺少 providerId');
        setLoading(false);
        return;
      }
      Api.ssoCallback(providerId, { code, state })
        .then((resp) => {
          if (!resp.accessToken) {
            setError('SSO 回调未返回 accessToken');
            return;
          }
          const authedUser: AuthUser = {
            id: resp.userId ?? '',
            username: resp.username ?? '',
            tenantId: 'tenant-default',
            roles: ['USER'],
          };
          login(authedUser, resp.accessToken, resp.refreshToken);
          sessionStorage.removeItem('sso_state');
          sessionStorage.removeItem('sso_provider');
          // 清理 URL 并跳转
          window.history.replaceState({}, '', '/login');
          navigate('/dashboard');
        })
        .catch((e: unknown) => {
          setError(e instanceof Error ? e.message : 'SSO 回调失败');
        })
        .finally(() => setLoading(false));
    }
  }, [login, navigate]);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--background)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 背景光效 */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 600,
          height: 600,
          background: 'radial-gradient(circle, rgba(250,250,250,0.018) 0%, transparent 70%)',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 400, padding: '0 20px' }}>
        <div
          className="v-card"
          style={{
            background: 'rgba(17, 17, 17, 0.72)',
            backdropFilter: 'blur(28px) saturate(1.3)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '36px 32px 28px',
          }}
        >
          {/* Logo — 品牌图标（六边形 + 内嵌条形图） */}
          <div style={{ marginBottom: 24 }}>
            <MateBrand iconSize={26} badgeSize="md" />
          </div>

          <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4, color: 'var(--foreground)' }}>
            欢迎回来
          </h1>
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 24, lineHeight: 1.5 }}>
            登录 Mate Platform，开启企业级 AI 协作
          </p>

          <div style={{ height: 1, background: 'var(--border)', marginBottom: 22 }} />

          {/* SSO 登录：显示后端已启用的提供方 */}
          {ssoProviders.length > 0 && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {ssoProviders.map((p) => {
                  const preset = matchPreset(p);
                  const brandColor = preset?.color || 'var(--muted-foreground)';
                  const brandLabel = (preset?.brand?.[0] || 'S').toUpperCase();
                  const isLoading = !!ssoLoading[p.providerId];
                  return (
                    <button
                      key={p.providerId}
                      onClick={() => handleSsoLogin(p)}
                      disabled={loading || isLoading}
                      style={{
                        width: '100%',
                        justifyContent: 'center',
                        height: 42,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        background: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius)',
                        color: 'var(--foreground)',
                        cursor: loading || isLoading ? 'not-allowed' : 'pointer',
                        opacity: loading || isLoading ? 0.6 : 1,
                        fontSize: 13,
                        fontWeight: 500,
                        fontFamily: 'inherit',
                      }}
                      onMouseEnter={(e) => { if (!loading && !isLoading) e.currentTarget.style.borderColor = brandColor; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                    >
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 22,
                        height: 22,
                        borderRadius: 4,
                        background: brandColor,
                        color: '#fff',
                        fontSize: 12,
                        fontWeight: 700,
                      }}>{brandLabel}</span>
                      {isLoading ? (
                        <>
                          <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                          正在跳转…
                        </>
                      ) : (
                        <>使用 {p.name} 登录</>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* 分隔线 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>或</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>
            </>
          )}

          {/* 账号密码 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              className="v-input"
              style={{ height: 42 }}
              placeholder="用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <input
              className="v-input"
              type="password"
              style={{ height: 42 }}
              placeholder="密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            {error && (
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--destructive)',
                  background: 'rgba(220, 38, 38, 0.08)',
                  border: '1px solid rgba(220, 38, 38, 0.2)',
                  borderRadius: 'var(--radius)',
                  padding: '8px 12px',
                }}
              >
                {error}
              </div>
            )}
            <button
              className="v-btn-primary"
              style={{ width: '100%', justifyContent: 'center', height: 42 }}
              onClick={handleLogin}
              disabled={loading}
            >
              {loading ? '登录中...' : '登录'}
            </button>
          </div>

          <p style={{ fontSize: 12, color: 'var(--muted-foreground)', textAlign: 'center', marginTop: 20 }}>
            默认账号：admin / Admin@12345（租户：tenant-default）
          </p>
        </div>
      </div>

      {/* 让 spin 动画生效（避免修改全局 css） */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}






