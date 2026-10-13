import { defineConfig } from 'vitest/config';
// Inline empty postcss config so Vite never walks up to an unrelated parent project's postcss.config.
export default defineConfig({ css: { postcss: {} }, test: { include: ['test/**/*.test.ts'] } });
