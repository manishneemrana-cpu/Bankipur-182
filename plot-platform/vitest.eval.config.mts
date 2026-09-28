import path from "node:path";

import { defineConfig } from "vitest/config";

// AI behavioral eval suite (§21 tests 9-11, Phase 6 gate; final deliverable
// per §24 "AI assistant with eval suite"). Separate from the default `npm
// test` run because it needs a live AI_API_KEY and makes real model calls —
// every test skips itself (not fails) when no key is configured, so this
// is safe to run in any environment but only meaningful with one.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname),
      "server-only": path.resolve(
        import.meta.dirname,
        "tests/unit/stubs/server-only.ts",
      ),
    },
  },
  test: {
    environment: "node",
    include: ["tests/eval/**/*.eval.ts"],
    testTimeout: 30_000,
  },
});
