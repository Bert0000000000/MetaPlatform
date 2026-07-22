import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Hexagon } from 'lucide-react';
import { useAuth } from '@mate/shared';
import { MOCK_LOGIN } from '@/mock'; // MOCK

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    setLoading(true);
    // MOCK: 模拟登录延迟
    setTimeout(() => {
      login(MOCK_LOGIN.user, MOCK_LOGIN.accessToken, MOCK_LOGIN.refreshToken);
      navigate('/dashboard');
    }, 500);
  };

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
          {/* Logo */}
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Hexagon style={{ width: 24, height: 24, strokeWidth: 1.5 }} />
            <span style={{ background: 'var(--primary)', color: 'var(--primary-foreground)', padding: '3px 10px', borderRadius: 'var(--radius)' }}>
              Mate
            </span>
          </div>

          <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4, color: 'var(--foreground)' }}>
            欢迎回来
          </h1>
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 24, lineHeight: 1.5 }}>
            登录 Mate Platform，开启企业级 AI 协作
          </p>

          <div style={{ height: 1, background: 'var(--border)', marginBottom: 22 }} />

          {/* SSO 登录 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            <button
              className="v-btn"
              style={{ width: '100%', justifyContent: 'center', height: 42 }}
              onClick={handleLogin}
              disabled={loading}
            >
              {loading ? '登录中...' : 'SSO 单点登录'}
            </button>
          </div>

          {/* 分隔线 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>或</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          {/* 账号密码 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              className="v-input"
              style={{ height: 42 }}
              placeholder="用户名"
              defaultValue="admin"
            />
            <input
              className="v-input"
              type="password"
              style={{ height: 42 }}
              placeholder="密码"
              defaultValue="admin123"
            />
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
            MOCK 模式：点击任意登录按钮即可进入
          </p>
        </div>
      </div>
    </div>
  );
}
