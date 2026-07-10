/**
 * 应用配置 —— 从环境变量读取，提供默认值
 * Sprint 0 阶段尚未接入 dotenv 自动加载，调用方需自行 require('dotenv').config()
 */
export interface AppConfig {
  port: number;
  env: string;
  nodeEnv: string;
  jwtSecret: string;
  ontologyEngineUrl: string;
  pageGeneratorUrl: string;
  metaplatformApiUrl: string;
  dbFile: string;
  logLevel: string;
  serviceVersion: string;
}

export const config: AppConfig = {
  port: Number(process.env.PORT ?? 3002),
  env: process.env.NODE_ENV ?? "development",
  nodeEnv: process.env.NODE_ENV ?? "development",
  jwtSecret: process.env.JWT_SECRET ?? "replace-me-with-shared-secret",
  ontologyEngineUrl: process.env.ONTOLOGY_ENGINE_URL ?? "http://localhost:8090",
  pageGeneratorUrl: process.env.PAGE_GENERATOR_URL ?? "http://localhost:8083",
  metaplatformApiUrl: process.env.METAPLATFORM_API_URL ?? "http://localhost:3001",
  dbFile: process.env.APP_DB_FILE ?? "./data/app.db",
  logLevel: process.env.LOG_LEVEL ?? "info",
  serviceVersion: "v1.0.1-sprint0",
};

export const SERVICE_VERSION = "v1.0.1-sprint0";
