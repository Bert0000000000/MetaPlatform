import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"],
    globals: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      include: ["src/**/*.js"],
      exclude: ["src/index.js", "src/db-adapter.js", "src/seed*.js", "src/pg-worker.mjs"],
    },
    testTimeout: 30000,
  },
});