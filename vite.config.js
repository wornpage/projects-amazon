import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:4317', changeOrigin: true },
      '/mcp': { target: 'http://127.0.0.1:4317', changeOrigin: true }
    }
  },
  build: { sourcemap: false }
});
