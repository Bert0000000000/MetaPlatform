import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

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
    port: 9240,
    // Path-prefix router that dispatches /v1/copilot/* (the SuperAI frontend legacy
    // APP-COPILOT surface) to the correct local TECH-* backend:
    //   /v1/copilot/auth/*         -> TECH-IAM   :8101  (/api/v1/iam/*)
    //   /v1/copilot/ontology/*     -> TECH-ONT   :8201  (/api/v1/ont/*)
    //   /v1/copilot/{superai,runs,conversations,actions,plans,agents,chat,models,a2a,tasks,skills,memory} -> TECH-AGENT :8511 (/api/v1/agent/*)
    //   /v1/copilot/{knowledge-bases,search,documents,citations,graph,context,kb} -> TECH-RAG :8901 (/api/v1/rag/* + /api/v1/kb/*)
    proxy: {
      // /v1/copilot/auth/*  -> TECH-IAM 8101, rewrite /v1/copilot/auth -> /api/v1/iam/auth
      '^/v1/copilot/auth/': {
        target: 'http://localhost:8101',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/v1\/copilot\/auth/, '/api/v1/iam/auth'),
      },
      // /v1/copilot/ontology/* -> TECH-ONT 8201, /v1/copilot/ontology -> /api/v1/ont
      '^/v1/copilot/ontology/': {
        target: 'http://localhost:8201',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/v1\/copilot\/ontology/, '/api/v1/ont'),
      },
      // /v1/copilot/knowledge-bases -> /api/v1/rag/knowledge-bases (RAG exposes this exact path)
      '^/v1/copilot/knowledge-bases': {
        target: 'http://localhost:8901',
        changeOrigin: true,
        rewrite: (p) => '/api/v1/rag/knowledge-bases',
      },
      // /v1/copilot/search -> /api/v1/rag/search
      '^/v1/copilot/search': {
        target: 'http://localhost:8901',
        changeOrigin: true,
        rewrite: (p) => '/api/v1/rag/search',
      },
      // PRIMARY catch-all: most /v1/copilot/* paths are SuperAI/Agent controller surfaces -> TECH-AGENT 8511.
      // Must come before RAG catch-all because superai/runs/conversations/actions/chat/* paths share the prefix.
      '^/v1/copilot/': {
        target: 'http://localhost:8511',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/v1\/copilot\//, '/api/v1/agent/'),
      },
      // KB-specific paths that don't exist on TECH-AGENT -> TECH-RAG 8901
      '^/v1/copilot/(documents|citations|graph|context|kb)': {
        target: 'http://localhost:8901',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/v1\/copilot\//, '/api/v1/'),
      },
    },
  },
  build: {
    target: 'es2020',
    minify: 'esbuild',
    sourcemap: false,
  },
});