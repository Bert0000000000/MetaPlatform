import base from '../../../metaplatform-frontend/apps/web/vite.config';
export default {
  ...base,
  root: new URL('../../../metaplatform-frontend/apps/web/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'),
  server: {
    ...base.server, host: '127.0.0.1', port: 9368, strictPort: true,
    proxy: {
      '/api/v1/iam': { target: 'http://127.0.0.1:55523', changeOrigin: true },
      '/api/v1/dashboard': { target: 'http://127.0.0.1:55523', changeOrigin: true },
      '/api/v1': { target: 'http://127.0.0.1:55522', changeOrigin: true, ws: true },
    },
  },
};
