import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Inline empty postcss config so Vite never walks up to an unrelated parent project's postcss.config.
export default defineConfig({ plugins: [react()], css: { postcss: {} }, build: { target: 'es2022', chunkSizeWarningLimit: 1500 } });
