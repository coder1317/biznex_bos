import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, proxy API + websocket to the local server so the UI works
// without CORS setup. In production the server serves pos-web/dist itself.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/health': { target: 'http://localhost:3000', changeOrigin: true },
      '/ws': { target: 'ws://localhost:3000', ws: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
