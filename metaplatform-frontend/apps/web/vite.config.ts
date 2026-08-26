import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Use the IPv4 loopback by default for the local browser-to-Docker gateway
// path. On Windows, `localhost` may resolve to IPv6 while Docker publishes
// the gateway on IPv4, leaving page API calls hanging until they time out.
const proxyHost = process.env.VITE_PROXY_HOST ?? '127.0.0.1';
const proxyTarget = (port: number) => `http://${proxyHost}:${port}`;
// v3.2 unified backend port (all app packages mounted on one server)
const BACKEND_PORT = Number(process.env.VITE_BACKEND_PORT ?? 8100);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@mate/shared$': path.resolve(import.meta.dirname, '../../packages/shared/src/index.ts'),
      '@ant-design/icons$': path.resolve(import.meta.dirname, '../../packages/shared/src/icons/index.tsx'),
      // react-syntax-highlighter 异步语言注册表动态 import 的 highlight.js 语言文件解析
      'highlight.js/lib/languages/sql_more': path.resolve(import.meta.dirname, '../../node_modules/.pnpm/highlight.js@10.7.3/node_modules/highlight.js/lib/languages/sql_more.js'),
    },
  },
  server: {
    port: 9200,
    proxy: {
      // v3.2: all routes proxy to unified backend on BACKEND_PORT (default 8100)
      '/api/v1': { target: proxyTarget(BACKEND_PORT), changeOrigin: true,
        // MP-SAL: 透传浏览器 Authorization/X-Tenant-Id 头（默认 vite 不转，否则 401）
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            if (req.headers.authorization) proxyReq.setHeader('Authorization', req.headers.authorization);
            if (req.headers['x-tenant-id']) proxyReq.setHeader('X-Tenant-Id', req.headers['x-tenant-id']);
          });
        },
      },
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




