/*
 * @file: frontend/vite.config.js
 * @purpose: Configuration for Vite bundler, dev server settings (ports, hosts, allowedHosts), and proxying API/Websocket connections to the backend.
 * @dependencies: vite, path
 * @last_update: 2026-05-20 / v1.0.0
 */
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  plugins: [],
  server: {
    port: 5173,
    host: true, // Listen on all network interfaces (important for Docker/remote NAS)
    allowedHosts: ['gtd-dev.ammar-nas.duckdns.org', 'gtd-frontend-dev'],
    watch: {
      usePolling: true
    },
    proxy: {
      '/socket.io': {
        target: 'http://gtd-backend-dev:3000',
        ws: true, // Critical for Socket.io WebSocket connections
        changeOrigin: true
      },
      '/api': {
        target: 'http://gtd-backend-dev:3000',
        changeOrigin: true
      }
    }
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        game: path.resolve(__dirname, 'game.html')
      }
    }
  }
});
