import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30 * 1000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "portal", use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:5173" } },
    { name: "dashboard", use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:5174" } },
    { name: "ontstudio", use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:5175" } },
    { name: "kb", use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:5176" } },
    { name: "mcphub", use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:5177" } },
    { name: "apphub", use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:5178" } },
    { name: "arch", use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:5179" } },
    { name: "dw", use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:5180" } },
    { name: "superai", use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:5181" } },
  ],
  webServer: [
    { command: "pnpm --filter @mate/bff dev", port: 3000, reuseExistingServer: !process.env.CI },
  ],
});