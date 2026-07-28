import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const proxyHost = process.env.VITE_PROXY_HOST ?? 'localhost';
const proxyTarget = (port: number) => `http://${proxyHost}:${port}`;

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
      // === TECH-IAM ===
      '/api/v1/iam':    { target: proxyTarget(8102), changeOrigin: true },
      // mate-tech-iam
      // === APP-DASHBOARD (workbench BFF) ===
      '/api/v1/dashboard': { target: proxyTarget(9001), changeOrigin: true },
      // === TECH-AGENT ===
      '/api/v1/agent':  { target: proxyTarget(8511), changeOrigin: true },
      // === TECH-MCP ===
      '/api/v1/mcp':    { target: proxyTarget(8105), changeOrigin: true },
      // === TECH-RAG ===
      '/api/v1/rag':    { target: proxyTarget(8901), changeOrigin: true },
      // === TECH-ONT ===
      '/api/v1/ont':    { target: proxyTarget(8301), changeOrigin: true },
      // === TECH-WFE ===
      '/api/v1/wfe':    { target: proxyTarget(8311), changeOrigin: true },
      // === TECH-EA ===
      '/api/v1/ea':     { target: proxyTarget(8321), changeOrigin: true },
      // === TECH-RULE ===
      '/api/v1/rule':   { target: proxyTarget(8331), changeOrigin: true },
      // === TECH-ACTION ===
      '/api/v1/action': { target: proxyTarget(8341), changeOrigin: true },
      // === TECH-DATA ===
      '/api/v1/data':   { target: proxyTarget(8701), changeOrigin: true },
      // === TECH-LLMGW ===
      '/api/v1/llmgw':  { target: proxyTarget(8210), changeOrigin: true },
      // === TECH-OBS ===
      '/api/v1/obs':    { target: proxyTarget(8401), changeOrigin: true },
      // === TECH-MSG ===
      '/api/v1/msg':    { target: proxyTarget(8411), changeOrigin: true },
      // === TECH-A2A ===
      '/api/v1/a2a':    { target: proxyTarget(8502), changeOrigin: true },
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


