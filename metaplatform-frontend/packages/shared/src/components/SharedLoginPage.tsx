/**
 * SharedLoginPage - Workbench / Portal / Dashboard 共用登录页
 *
 * "dev 即 prod": 9200/9230/... 一套 UI、一套行为、一份代码。
 *
 * 设计：左侧品牌面板 + 右侧 SSO/账号密码登录卡片
 * 行为：useAuth() 统一状态机 + login() 调 IAM + SSO 回调解析
 *
 * 通过 props 让上层注入品牌信息（标题/副标题/标签），默认 fallback 合理。
 */
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Sparkles } from "lucide-react";
import { useAuth, type AuthUser } from "../auth/AuthProvider";
import {
  login as apiLogin,
  listEnabledSsoProviders,
  getSsoAuthorizeUrl,
  ssoCallback,
  matchPreset,
  type SsoProvider,
} from "../api";
import MateLogo from "./MateLogo";

export interface SharedLoginPageProps {
  /** 品牌主标题，默认 "MetaPlatform" */
  brandTitle?: string;
  /** 品牌副标题，默认 "Ontology" */
  brandSubtitle?: string;
  /** 标语，默认 "企业 AI AgentOS" */
  brandTagline?: string;
  /** 描述文本 */
  brandDescription?: string;
  /** 品牌标签 pills */
  brandTags?: Array<{ label: string; icon?: React.ReactNode }>;
  /** 默认租户 ID */
  defaultTenantId?: string;
  /** 默认用户名（dev 友好） */
  defaultUsername?: string;
  /** 默认密码（dev 友好） */
  defaultPassword?: string;
  /** 登录后跳转路径，默认 "/dashboard" */
  redirectTo?: string;
}

const DEFAULT_TAGS: Array<{ label: string; icon?: React.ReactNode }> = [
  { label: "本体驱动" },
  { label: "SSO 登录" },
  { label: "数字员工" },
];

export default function SharedLoginPage(props: SharedLoginPageProps) {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();

  const brandTitle = props.brandTitle ?? "MetaPlatform";
  const brandSubtitle = props.brandSubtitle ?? "Ontology";
  const brandTagline = props.brandTagline ?? "企业 AI AgentOS";
  const brandDescription =
    props.brandDescription ??
    "基于本体论（Ontology）构建的企业 AI AgentOS — 把企业知识、业务流程与数字员工装进同一个可解释的运行时，让智能从对话走向执行。";
  const brandTags = props.brandTags ?? DEFAULT_TAGS;
  const defaultTenantId = props.defaultTenantId ?? "tenant-default";
  const defaultUsername = props.defaultUsername ?? "admin";
  const defaultPassword = props.defaultPassword ?? "admin123";
  const redirectTo = props.redirectTo ?? "/dashboard";

  const [username, setUsername] = useState(defaultUsername);
  const [password, setPassword] = useState(defaultPassword);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ssoProviders, setSsoProviders] = useState<SsoProvider[]>([]);
  const [ssoLoading, setSsoLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isAuthenticated) {
      navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, navigate, redirectTo]);

  useEffect(() => {
    listEnabledSsoProviders().then(setSsoProviders).catch(() => setSsoProviders([]));
  }, []);


  const handleLogin = async () => {
    if (!username || !password) {
      setError("请输入用户名和密码");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const resp = await apiLogin({ username, password, tenantId: defaultTenantId });
      const user: AuthUser = {
        id: resp.userId ?? resp.user?.id ?? "",
        username: resp.username ?? resp.user?.username ?? username,
        tenantId: defaultTenantId,
        realName: resp.realName ?? resp.user?.realName,
        email: resp.user?.email,
        roles: ["USER"],
      };
      login(user, resp.accessToken, resp.refreshToken);
      navigate(redirectTo);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "登录失败，请重试";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLogin();
  };

  const handleSsoLogin = async (p: SsoProvider) => {
    setSsoLoading((m) => ({ ...m, [p.providerId]: true }));
    setError(null);
    try {
      const info = await getSsoAuthorizeUrl(p.providerId, window.location.origin + "/sso/callback");
      try {
        sessionStorage.setItem("sso_state", info.state);
        sessionStorage.setItem("sso_provider", p.providerId);
      } catch {
        /* ignore quota errors */
      }
      window.location.href = info.authorizeUrl;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "发起 SSO 登录失败";
      setError(msg);
      setSsoLoading((m) => ({ ...m, [p.providerId]: false }));
    }
  };


  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    if (!code || !state) return;
    const providerId = sessionStorage.getItem("sso_provider");
    if (!providerId) return;
    const expectedState = sessionStorage.getItem("sso_state");
    if (expectedState && expectedState !== state) {
      setError("SSO state 校验失败，请重新登录");
      return;
    }
    setError(null);
    setLoading(true);
    ssoCallback(providerId, { code, state })
      .then((resp) => {
        if (!resp.accessToken) {
          setError("SSO 回调未返回 accessToken");
          return;
        }
        const user: AuthUser = {
          id: resp.userId ?? "",
          username: resp.username ?? "",
          tenantId: defaultTenantId,
          roles: ["USER"],
        };
        login(user, resp.accessToken, resp.refreshToken);
        sessionStorage.removeItem("sso_state");
        sessionStorage.removeItem("sso_provider");
        window.history.replaceState({}, "", "/login");
        navigate(redirectTo);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "SSO 回调失败");
      })
      .finally(() => setLoading(false));
  }, [login, navigate, redirectTo, defaultTenantId]);


  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--background)",
        display: "flex",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "8%",
          top: "50%",
          transform: "translateY(-50%)",
          width: 480,
          height: 480,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(99, 102, 241, 0.18) 0%, rgba(99, 102, 241, 0) 70%)",
          filter: "blur(40px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "5%",
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
          flexDirection: "column",
          gap: 24,
          zIndex: 1,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <MateLogo size={56} />
          <div>
            <div
              style={{
                fontSize: 36,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: "var(--foreground)",
                lineHeight: 1.1,
              }}
            >
              {brandTitle}
            </div>
            <div
              style={{
                fontSize: 18,
                color: "var(--muted-foreground)",
                marginTop: 4,
                fontWeight: 500,
              }}
            >
              {brandSubtitle}
            </div>
          </div>
        </div>
        <div style={{ maxWidth: 520 }}>
          <div
            style={{
              fontSize: 26,
              fontWeight: 600,
              color: "var(--foreground)",
              marginBottom: 16,
              letterSpacing: "-0.01em",
            }}
          >
            {brandTagline}
          </div>
          <div
            style={{
              fontSize: 14,
              color: "var(--muted-foreground)",
              lineHeight: 1.7,
            }}
          >
            {brandDescription}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
          {brandTags.map((t, i) => (
            <span
              key={i}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
                borderRadius: 999,
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid var(--border)",
                color: "var(--muted-foreground)",
                fontSize: 12,
              }}
            >
              {t.icon ?? <Sparkles size={12} />}
              {t.label}
            </span>
          ))}
        </div>
      </div>


      <div
        style={{
          position: "absolute",
          right: "8%",
          top: "50%",
          transform: "translateY(-50%)",
          width: 380,
          zIndex: 2,
        }}
      >
        <div
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: 32,
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.4)",
          }}
        >
          <div style={{ marginBottom: 24 }}>
            <div
              style={{
                fontSize: 22,
                fontWeight: 600,
                color: "var(--foreground)",
                marginBottom: 8,
              }}
            >
              欢迎回来
            </div>
            <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
              登录 {brandTitle}，开启{brandTagline}协作
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
            {ssoProviders.length === 0 && (
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: "var(--radius)",
                  border: "1px dashed var(--border)",
                  fontSize: 12,
                  color: "var(--muted-foreground)",
                  background: "rgba(255, 255, 255, 0.02)",
                }}
              >
                暂未配置 SSO 提供方，请到{" "}
                <strong style={{ color: "var(--foreground)" }}>系统配置</strong>{" "}
                中开启企业微信/微信/飞书登录
              </div>
            )}
            {ssoProviders.map((p) => {
              const preset = matchPreset(p);
              const brandColor = preset?.color || "var(--muted-foreground)";
              const brandLabel = (preset?.brand?.[0] || "S").toUpperCase();
              const isLoading = !!ssoLoading[p.providerId];
              return (
                <button
                  key={p.providerId}
                  onClick={() => handleSsoLogin(p)}
                  disabled={loading || isLoading}
                  style={{
                    width: "100%",
                    justifyContent: "center",
                    height: 42,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    color: "var(--foreground)",
                    cursor: loading || isLoading ? "not -allowed" : "pointer",
                    opacity: loading || isLoading ? 0.6 : 1,
                    fontSize: 13,
                    fontWeight: 500,
                    fontFamily: "inherit",
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 22,
                      height: 22,
                      borderRadius: 4,
                      background: brandColor,
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {brandLabel}
                  </span>
                  {isLoading ? (
                    <>
                      <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                      正在跳转…
                    </>
                  ) : (
                    <>使用 {p.name} 登录</>
                  )}
                </button>
              );
            })}
          </div>


          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>或使用账号密码</span>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              className="v-input"
              style={{ height: 42, width: "100%" }}
              placeholder="用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <input
              className="v-input"
              type="password"
              style={{ height: 42, width: "100%" }}
              placeholder="密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            {error && (
              <div
                style={{
                  fontSize: 12,
                  color: "var(--destructive)",
                  background: "rgba(220, 38, 38, 0.08)",
                  border: "1px solid rgba(220, 38, 38, 0.2)",
                  borderRadius: "var(--radius)",
                  padding: "8px 12px",
                }}
              >
                {error}
              </div>
            )}
            <button
              className="v-btn-primary"
              style={{ width: "100%", justifyContent: "center", height: 42 }}
              onClick={handleLogin}
              disabled={loading}
            >
              {loading ? "登录中…" : "登录"}
            </button>
          </div>

          <p
            style={{
              fontSize: 12,
              color: "var(--muted-foreground)",
              textAlign: "center",
              marginTop: 20,
            }}
          >
            默认账号：admin / admin123（租户：{defaultTenantId}）
          </p>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
