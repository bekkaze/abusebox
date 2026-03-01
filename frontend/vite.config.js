/// <reference types="vite/client" />

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default ({ mode }) => {
  process.env = { ...process.env, ...loadEnv(mode, process.cwd()) };
  const host = process.env.VITE_DEV_HOST || '0.0.0.0';
  const allowedHosts = (process.env.VITE_ALLOWED_HOSTS || 'localhost,127.0.0.1')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const config = {
    plugins: [react()],
    server: {
      host,
      port: 3000,
      strictPort: true,
      allowedHosts,
      cors: {
        origin: /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
      },
      fs: {
        strict: true,
        deny: ['.env', '.env.*', '*.pem', '*.crt', '**/.git/**'],
      },
      proxy: {
        '/api': {
          target: process.env.VITE_BASE_URL,
          secure: false,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  };
  return defineConfig(config);
};
