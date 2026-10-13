import { defineConfig } from 'tsup';

// Bundle the workspace package (it ships as TS source) into the server build.
export default defineConfig({ entry: ['src/index.ts'], format: ['esm'], target: 'node20', clean: true, noExternal: ['@dt/shared-types'] });
