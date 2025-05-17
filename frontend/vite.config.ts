import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    sourcemap: true,           // generate source maps in production builds
  },
  logLevel: 'info', 
  server: {
    proxy: {
      // proxy anything under /api to your backend
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        // optional: rewrite the path on the way out
        // rewrite: (path) => path.replace(/^\/api/, '/api'),
      },
    },
  },
});
