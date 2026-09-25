import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: process.env.HELM_API_URL ?? 'http://localhost:3000' },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rolldownOptions: {
      output: {
        // Libraries every screen needs at startup go in their own long-cached chunk, so a release
        // only invalidates the app's code. Everything else (Mantine included) is split
        // automatically, which keeps components used by one lazy screen out of the first load.
        codeSplitting: {
          groups: [
            {
              name: 'vendor',
              test: /node_modules[\\/](react|react-dom|react-router|scheduler|@tanstack)[\\/]/,
            },
          ],
        },
      },
    },
  },
});
