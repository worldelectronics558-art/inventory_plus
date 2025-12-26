import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import tailwindcss from '@tailwindcss/vite';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  plugins: [react(), svgr(), tailwindcss()],

  optimizeDeps: {
    exclude: ['@tauri-apps/api']
  },

  // --- Tauri/Vite Specific Config ---
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: true, // Listen on all network interfaces
    https: {
      key: fs.readFileSync(path.resolve(__dirname, 'src-tauri/certs/key.pem')),
      cert: fs.readFileSync(path.resolve(__dirname, 'src-tauri/certs/cert.pem')),
    },
    hmr: {
      protocol: 'wss',
    },
  },
  // --- END Config ---
});
