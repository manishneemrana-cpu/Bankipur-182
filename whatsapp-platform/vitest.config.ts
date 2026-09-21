import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // "server-only" throws when imported outside Next's "react-server"
      // condition (which vitest doesn't set) — alias it to its own no-op
      // build here so tests can import real server modules directly instead
      // of re-implementing their logic just to avoid the guard.
      "server-only": path.resolve(__dirname, "node_modules/server-only/empty.js"),
    },
  },
});
