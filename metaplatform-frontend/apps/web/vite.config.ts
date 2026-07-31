import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const proxyHost = process.env.VITE_PROXY_HOST ?? 'localhost';
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
    },
  },
  server: {
    port: 9200,
    proxy: {
      // v3.2: all routes proxy to unified backend on BACKEND_PORT (default 8100)
      '/api/v1': { target: proxyTarget(BACKEND_PORT), changeOrigin: true },
    },
  },
  optimizeDeps: {
    include: [
      'prismjs',
      'antd',
      '@flowgram.ai/fixed-layout-editor',
      '@flowgram.ai/fixed-semi-materials',
      '@flowgram.ai/minimap-plugin',
      '@flowgram.ai/export-plugin',
      '@flowgram.ai/shortcuts-plugin',
      '@flowgram.ai/free-hover-plugin',
      '@douyinfe/semi-ui',
      '@douyinfe/semi-icons',
      '@antv/g6',
    ],
  },
  build: {
    target: 'es2020',
    minify: 'esbuild',
    sourcemap: false,
  },
});




