import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: [
        { find: /^@\/(.*)/, replacement: path.resolve(__dirname, 'src/$1') },
        { find: '@', replacement: path.resolve(__dirname, 'src') },
      ],
    },

    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'three-vendor': ['three'],
            'firebase-vendor': ['firebase/app', 'firebase/auth'],
            'ui-vendor': ['react', 'react-dom', 'lucide-react', 'motion/react'],
            'porcupine-vendor': ['@picovoice/porcupine-web', '@picovoice/web-voice-processor'],
          }
        }
      },
      chunkSizeWarningLimit: 1000

    }
  };
});


