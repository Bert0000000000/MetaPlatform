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
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  // 关键：把 antd / @ant-design/x / prismjs / @flowgram.ai/* 全部纳入预构建，
  // 避免 dev 模式下 UMD 包装器（prismjs、@ant-design/x 的 dist/antdx.js）
  // 与 ESM 入口（@ant-design/x 的 es/）出现双重实例或 Prism 未定义错误。
  // 注意：optimizeDeps.include 只接受顶层包名，传递依赖由 Vite 自动发现。
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