import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@ant-design/icons$': path.resolve(import.meta.dirname, '../../packages/shared/src/icons/index.tsx'),
    },
  },
  server: {
    port: 9104,
    proxy: {
      '/api/v1/kb':   { target: 'http://localhost:9004', changeOrigin: true },
      '/api/v1/rag':  { target: 'http://localhost:8901', changeOrigin: true },
      '/api/v1/ont':  { target: 'http://localhost:8201', changeOrigin: true },
    },
  },
});
