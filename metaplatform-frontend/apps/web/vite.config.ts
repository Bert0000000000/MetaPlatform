import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import SemiPlugin from '@douyinfe/semi-vite-plugin';
import path from 'path';

// Use the IPv4 loopback by default for the local browser-to-Docker gateway
// path. On Windows, `localhost` may resolve to IPv6 while Docker publishes
// the gateway on IPv4, leaving page API calls hanging until they time out.
const proxyHost = process.env.VITE_PROXY_HOST ?? '127.0.0.1';
const proxyTarget = (port: number) => `http://${proxyHost}:${port}`;
// v3.2 unified backend port (all app packages mounted on one server)
const BACKEND_PORT = Number(process.env.VITE_BACKEND_PORT ?? 8100);
// Agent 产品层服务（mate-tech-agent-team, 8013）尚未进 compose。本地联调时
// 设 VITE_AGENT_TEAM_PORT=8013 即可让 dev server 直连本机跑的实例；
// 不设时行为与之前完全一致（走网关）。
const AGENT_TEAM_PORT = process.env.VITE_AGENT_TEAM_PORT;

// 浏览器头透传：vite 默认不转 Authorization/X-Tenant-Id，不转就 401。
const forwardAuth = {
  configure: (proxy: {
    on: (event: string, cb: (target: { setHeader: (k: string, v: string) => void }, req: { headers: Record<string, string | undefined> }) => void) => void;
  }) => {
    proxy.on('proxyReq', (proxyReq, req) => {
      if (req.headers.authorization) proxyReq.setHeader('Authorization', req.headers.authorization);
      if (req.headers['x-tenant-id']) proxyReq.setHeader('X-Tenant-Id', req.headers['x-tenant-id']);
    });
  },
};

export default defineConfig({
  // Semi 官方主题定制：DSM 主题包（构建期替换官方 SCSS 变量）。
  // 见 docs/active/specs/2026-09-14-ui-redesign/DESIGN-SPEC.md §4 与 packages/semi-theme-mate。
  plugins: [react(), SemiPlugin({ theme: '@mate/semi-theme' })],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@mate/shared$': path.resolve(import.meta.dirname, '../../packages/shared/src/index.ts'),
      '@ant-design/icons$': path.resolve(import.meta.dirname, '../../packages/shared/src/icons/index.tsx'),
    },
  },
  server: {
    // 与 E2E（playwright.config.ts）和 UI-P0 设计规范约定的 dev 端口保持一致
    port: 9250,
    proxy: {
      // 更具体的前缀必须排在 '/api/v1' 之前，否则会被兜底规则吃掉
      ...(AGENT_TEAM_PORT
        ? {
            '/api/v1/agent-team': {
              target: proxyTarget(Number(AGENT_TEAM_PORT)),
              changeOrigin: true,
              ...forwardAuth,
            },
          }
        : {}),
      // v3.2: all routes proxy to unified backend on BACKEND_PORT (default 8100)
      '/api/v1': { target: proxyTarget(BACKEND_PORT), changeOrigin: true, ...forwardAuth },
    },
  },
  optimizeDeps: {
    include: [
      'prismjs',
      'lowlight',
      'highlight.js',
      '@ant-design/x',
      'react-syntax-highlighter',
      'antd',
      '@flowgram.ai/fixed-layout-editor',
      '@flowgram.ai/fixed-semi-materials',
      '@flowgram.ai/minimap-plugin',
      '@flowgram.ai/export-plugin',
      '@flowgram.ai/shortcuts-plugin',
      '@flowgram.ai/free-hover-plugin',
      '@douyinfe/semi-ui',
      '@douyinfe/semi-icons',
    ],
    // sql_more 已通过 resolve.alias 指向实际文件，react-syntax-highlighter 纳入预构建。
  },
  build: {
    target: 'es2020',
    minify: 'esbuild',
    sourcemap: false,
  },
});
