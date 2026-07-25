import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Dev proxy: forwards /api/* to the .NET backend so the browser sees a
// same-origin URL (no CORS in dev). Override the target with VITE_BACKEND_ORIGIN.
export default defineConfig(({ mode }) => {
  // loadEnv reads .env files here; process.env does NOT get them in config.
  const env = loadEnv(mode, process.cwd(), '');
  const BACKEND_ORIGIN = env.VITE_BACKEND_ORIGIN || 'https://localhost:7001';

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: BACKEND_ORIGIN,
          changeOrigin: true,
          secure: false, // accept the backend's self-signed dev certificate
        },
      },
    },
  };
});
