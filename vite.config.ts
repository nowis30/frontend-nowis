import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Forcer React en mode développement lors du dev server pour éviter les erreurs minifiées (#310)
export default defineConfig(({ command }) => ({
  plugins: [react()],
  define: command === 'serve' ? { 'process.env.NODE_ENV': JSON.stringify('development') } : {},
  optimizeDeps: command === 'serve' ? { esbuildOptions: { define: { 'process.env.NODE_ENV': '"development"' } } } : undefined,
  resolve: {
    dedupe: ['react', 'react-dom']
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true
      }
    }
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          mui: ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
          router: ['react-router-dom'],
          query: ['@tanstack/react-query']
        }
      }
    }
  }
}));
