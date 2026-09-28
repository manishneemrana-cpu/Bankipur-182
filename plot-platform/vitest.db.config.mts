import { defineConfig } from "vitest/config";

// Separate from vitest.config.mts: DB tests need a real Postgres and run
// sequentially against shared cluster-level state (advisory locks aside).
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/db/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
});
