import { defineConfig } from 'vite';

// Plain static build: output goes to web/dist, no server code.
// In dev and preview, Vite falls back to index.html for /protein/<ID> routes.
export default defineConfig({
  server: { port: 5173, host: true },
  preview: { port: 4173, host: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
});
