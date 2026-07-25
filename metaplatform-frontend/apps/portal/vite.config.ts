import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@mate/shared$': path.resolve(import.meta.dirname, '../../packages/shared/src/index.ts'),
    },
  },
  server: {
    port: 9200,
    proxy: {
      // === TECH-IAM ===
      '/api/v1/iam':    { target: 'http://localhost:8101', changeOrigin: true },
      // === TECH-AGENT ===
      '/api/v1/agent':  { target: 'http://localhost:8511', changeOrigin: true },
      // === TECH-MCP ===
      '/api/v1/mcp':    { target: 'http://localhost:8105', changeOrigin: true },
      // === TECH-RAG ===
      '/api/v1/rag':    { target: 'http://localhost:8901', changeOrigin: true },
      // === TECH-ONT ===
      '/api/v1/ont':    { target: 'http://localhost:8301', changeOrigin: true },
      // === TECH-WFE ===
      '/api/v1/wfe':    { target: 'http://localhost:8311', changeOrigin: true },
      // === TECH-EA ===
      '/api/v1/ea':     { target: 'http://localhost:8321', changeOrigin: true },
      // === TECH-RULE ===
      '/api/v1/rule':   { target: 'http://localhost:8331', changeOrigin: true },
      // === TECH-ACTION ===
      '/api/v1/action': { target: 'http://localhost:8341', changeOrigin: true },
      // === TECH-DATA ===
      '/api/v1/data':   { target: 'http://localhost:8701', changeOrigin: true },
      // === TECH-LLMGW ===
      '/api/v1/llmgw':  { target: 'http://localhost:8210', changeOrigin: true },
      // === TECH-OBS ===
      '/api/v1/obs':    { target: 'http://localhost:8401', changeOrigin: true },
      // === TECH-MSG ===
      '/api/v1/msg':    { target: 'http://localhost:8411', changeOrigin: true },
      // === TECH-A2A ===
      '/api/v1/a2a':    { target: 'http://localhost:8502', changeOrigin: true },
    },
  },
  optimizeDeps: {
    include: [
      'prismjs',
      'antd',
      '@ant-design/x',
      '@flowgram.ai/fixed-layout-editor',
      '@flowgram.ai/fixed-semi-materials',
      '@flowgram.ai/minimap-plugin',
      '@flowgram.ai/export-plugin',
      '@flowgram.ai/shortcuts-plugin',
      '@flowgram.ai/free-hover-plugin',
      '@flowgram.ai/background-plugin',
      '@douyinfe/semi-ui',
      '@douyinfe/semi-icons',
    ],
  },
  build: {
    target: 'es2020',
    minify: 'esbuild',
    sourcemap: false,
  },
});
