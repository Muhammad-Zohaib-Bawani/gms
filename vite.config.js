import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev proxy: forwards /api/* to the .NET backend so the browser sees a
// same-origin URL (no CORS in dev). Override the target with VITE_BACKEND_ORIGIN.
const BACKEND_ORIGIN = process.env.VITE_BACKEND_ORIGIN || 'https://localhost:7001';

export default defineConfig({
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
});
