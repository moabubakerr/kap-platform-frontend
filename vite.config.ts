import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// The browser only ever calls same-origin paths; the dev server (and nginx in
// the container) forwards them:
//   /api/platform/* → platform API (traces, jobs)   — adds the API key server-side
//   /api/kap/*      → KAP API
//   /api/askai/*    → Ask AI admin API
// PLATFORM_UPSTREAM defaults to the platform API through an SSH tunnel:
//   ssh -N -L 127.0.0.1:8180:127.0.0.1:8180 ubuntu@10.100.14.2
export default defineConfig(({ mode }) => {
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), '') };
  const platformKey = env.PLATFORM_API_KEY ?? '';
  return {
    plugins: [react()],
    resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
    server: {
      port: 5174,
      proxy: {
        '/api/platform': {
          target: env.PLATFORM_UPSTREAM ?? 'http://127.0.0.1:8180',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/platform/, '/api'),
          configure: (proxy) => {
            proxy.on('proxyReq', (req) => {
              if (platformKey) req.setHeader('Authorization', `Bearer ${platformKey}`);
            });
          },
        },
        '/api/kap': { target: env.KAP_UPSTREAM ?? 'http://127.0.0.1:8013', changeOrigin: true, rewrite: (p) => p.replace(/^\/api\/kap/, '/api') },
        '/api/askai': { target: env.ASKAI_UPSTREAM ?? 'http://localhost:18000', changeOrigin: true, rewrite: (p) => p.replace(/^\/api\/askai/, '') },
      },
    },
  };
});
