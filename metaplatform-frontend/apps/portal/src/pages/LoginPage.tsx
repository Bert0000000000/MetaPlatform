import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Sparkles, ShieldCheck } from 'lucide-react';
import { useAuth, Api, MateBrand, MateLogo, type AuthUser } from '@mate/shared';
import { matchPreset } from '@mate/shared/api';
import type { SsoProvider } from '@mate/shared/api';

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
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 左侧品牌面板背景光效 */}
      <div
        style={{
          position: 'absolute',
          left: '8%',
          top: '50%',
          transform: 'translateY(-50%)',
          width: 520,
          height: 520,
          background: 'radial-gradient(circle, rgba(96,165,250,0.08) 0%, transparent 65%)',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />

      {/* 左右分布局 */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          minHeight: '100vh',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(420px, 560px)',
        }}
      >
        {/* ===== 左侧：品牌面板 ===== */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '48px 56px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
            <MateLogo size={44} variant="color" />
            <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '0.01em' }}>MetaPlatform</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted-foreground)', letterSpacing: '0.04em', marginTop: 4 }}>Ontology</span>
            </span>
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 600, color: 'var(--foreground)', marginBottom: 12, lineHeight: 1.25, letterSpacing: '-0.02em' }}>
            企业级 AI 协作中台
          </h1>
          <p style={{ fontSize: 15, color: 'var(--muted-foreground)', lineHeight: 1.6, maxWidth: 480 }}>
            整合企业本体、知识库、数字员工与生成式 AI，
            为团队提供统一的智能作业与决策支撑。
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 28, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, background: 'var(--muted)', color: 'var(--muted-foreground)', fontSize: 12 }}>
              <Sparkles size={12} />本体驱动
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, background: 'var(--muted)', color: 'var(--muted-foreground)', fontSize: 12 }}>
              <ShieldCheck size={12} />SSO 登陆
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, background: 'var(--muted)', color: 'var(--muted-foreground)', fontSize: 12 }}>
              数字员工
            </span>
          </div>
        </div>

        {/* ===== 右侧：登陆面板 ===== */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px 40px',
            borderLeft: '1px solid var(--border)',
          }}
        >
          <div
            className="v-card"
            style={{
              width: '100%',
              maxWidth: 420,
              background: 'rgba(17, 17, 17, 0.72)',
              backdropFilter: 'blur(28px) saturate(1.3)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '36px 32px 28px',
            }}
          >
          <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4, color: 'var(--foreground)' }}>
            欢迎回来
          </h1>
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 24, lineHeight: 1.5 }}>
            登录 Mate Platform，开启企业级 AI 协作
          </p>

          <div style={{ height: 1, background: 'var(--border)', marginBottom: 22 }} />

          {/* SSO 登录：始终显示该区（未配置时给出空态提示） */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {ssoProviders.length === 0 && (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--radius)',
                  border: '1px dashed var(--border)',
                  background: 'transparent',
                  color: 'var(--muted-foreground)',
                  fontSize: 12,
                  textAlign: 'center',
                }}
              >
                暂未配置 SSO 提供方，请到 <strong style={{ color: 'var(--foreground)' }}>系统配置</strong> 中开启企业微信/微信/飞书登录
              </div>
            )}
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
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>或使用账号密码</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

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
      </div>

      {/* 让 spin 动画生效（避免修改全局 css） */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}









