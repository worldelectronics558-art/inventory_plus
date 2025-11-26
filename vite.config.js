import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr'; 
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), svgr(), tailwindcss()],
  
  // This block must be separated by a comma from the next property
  optimizeDeps: {
    exclude: [
      '@tauri-apps/api' // Exclude the entire Tauri API package
    ]
  }, // <-- COMMA ADDED HERE
  
  // --- Tauri/Vite Specific Config ---
  clearScreen: false,
  server: {
    port: 1420, // Tauri's default frontend port
    strictPort: true,
    host: true, // Needed for Tauri to access the dev server
    hmr: {
      protocol: 'ws',
    },
  },
  // --- END Config ---
});