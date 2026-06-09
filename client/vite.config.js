import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Single source of truth for board dimensions lives in the server
      // package; Vite inlines it into the client bundle at build time.
      '@board': fileURLToPath(new URL('../server/src/config.js', import.meta.url)),
    },
  },
  server: {
    port: 3000,
    fs: {
      // Allow importing the shared config from the sibling server package.
      allow: ['..'],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
});
