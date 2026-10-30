import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  css: {
    modules: { generateScopedName: '[name]__[local]' },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': `http://localhost:${process.env.API_PORT ?? 8100}`,
    },
  },
});
