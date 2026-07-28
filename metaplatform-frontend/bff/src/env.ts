/**
 * BFF Environment configuration.
 * ST-6.4.1.2 DoD: API_MODE 路由
 */
export const env = {
  PORT: parseInt(process.env.PORT ?? "3000", 10),
  NODE_ENV: process.env.NODE_ENV ?? "development",
  API_MODE: (process.env.API_MODE ?? "mock") as "mock" | "live" | "hybrid",
  UPSTREAM_BASE: process.env.UPSTREAM_BASE ?? "http://localhost:8000",
  LOG_LEVEL: process.env.LOG_LEVEL ?? "info",
} as const;