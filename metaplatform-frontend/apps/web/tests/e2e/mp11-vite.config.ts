import { defineConfig, mergeConfig } from 'vite';
import base from '../../vite.config';
export default mergeConfig(base, defineConfig({
  cacheDir: 'node_modules/.vite-codex-mp11-relationship',
  server: { host: '127.0.0.1', port: 55499, strictPort: true },
}));
