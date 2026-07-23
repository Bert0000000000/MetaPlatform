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
        port: 9201,
        proxy: {
            '/api/v1/iam': {
                target: 'http://localhost:8101',
                changeOrigin: true,
            },
            '/api/v1/wfe': {
                target: 'http://localhost:8202',
                changeOrigin: true,
            },
        },
    },
    build: {
        target: 'es2020',
        minify: 'esbuild',
        sourcemap: false,
    },
});
