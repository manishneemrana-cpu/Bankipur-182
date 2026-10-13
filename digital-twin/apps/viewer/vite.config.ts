import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  // Inline empty postcss config so Vite never walks up to an unrelated parent project's postcss.config.
  css: { postcss: {} },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
    rollupOptions: { output: { manualChunks: { three: ['three'], r3f: ['@react-three/fiber', '@react-three/drei'] } } },
  },
  test: { include: ['src/**/*.test.ts'] },
});
