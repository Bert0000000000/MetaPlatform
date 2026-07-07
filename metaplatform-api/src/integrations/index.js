/**
 * Infrastructure Integration Modules — Barrel File (ESM)
 *
 * Re-exports all infrastructure integration modules.
 * Each module gracefully handles missing configuration by providing
 * stub methods or in-process fallbacks where appropriate.
 *
 * @module integrations
 */

export * as neo4j from "./neo4j.js";
export * as elasticsearch from "./elasticsearch.js";
export * as milvus from "./milvus.js";
export * as minio from "./minio.js";
export * as kafka from "./kafka.js";
export { default as keycloak } from "./keycloak.js";
export { default as argocd } from "./argocd.js";
export { default as ocr } from "./ocr.js";
export { default as simulation } from "./simulation.js";
export { default as quality } from "./quality.js";

import * as neo4jModule from "./neo4j.js";
import * as esModule from "./elasticsearch.js";
import * as milvusModule from "./milvus.js";
import * as minioModule from "./minio.js";
import * as kafkaModule from "./kafka.js";
import keycloak from "./keycloak.js";
import argocd from "./argocd.js";
import ocr from "./ocr.js";
import simulation from "./simulation.js";
import quality from "./quality.js";

/**
 * Aggregate health check across all storage backends
 */
export async function healthCheckAll() {
  // Dynamic import to avoid circular dependency with integrations/clickhouse.js
  let clickhouseHealth = { status: "error", error: "module_not_loaded" };
  try {
    const ch = await import("./clickhouse.js");
    clickhouseHealth = await ch.healthCheck();
  } catch (e) {
    clickhouseHealth = { status: "error", error: e.message };
  }

  const results = await Promise.allSettled([
    neo4jModule.healthCheck(),
    esModule.healthCheck(),
    milvusModule.healthCheck(),
    minioModule.healthCheck(),
    kafkaModule.healthCheck(),
    Promise.resolve(clickhouseHealth),
  ]);

  return {
    neo4j: results[0].status === "fulfilled" ? results[0].value : { status: "error", error: results[0].reason?.message },
    elasticsearch: results[1].status === "fulfilled" ? results[1].value : { status: "error", error: results[1].reason?.message },
    milvus: results[2].status === "fulfilled" ? results[2].value : { status: "error", error: results[2].reason?.message },
    minio: results[3].status === "fulfilled" ? results[3].value : { status: "error", error: results[3].reason?.message },
    kafka: results[4].status === "fulfilled" ? results[4].value : { status: "error", error: results[4].reason?.message },
    clickhouse: results[5].status === "fulfilled" ? results[5].value : { status: "error", error: results[5].reason?.message },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Initialize all storage backends on server startup (idempotent)
 */
export async function initAll() {
  console.log("\n[Integrations] Initializing storage backends...");
  const results = {
    neo4j: false,
    elasticsearch: false,
    milvus: false,
    minio: false,
    kafka: false,
  };
  try {
    await neo4jModule.connect();
    results.neo4j = true;
  } catch (e) {
    console.warn("[Integrations] Neo4j init failed:", e.message);
  }
  try {
    await esModule.connect();
    results.elasticsearch = true;
  } catch (e) {
    console.warn("[Integrations] Elasticsearch init failed:", e.message);
  }
  try {
    await milvusModule.connect();
    results.milvus = true;
  } catch (e) {
    console.warn("[Integrations] Milvus init failed:", e.message);
  }
  try {
    await minioModule.connect();
    results.minio = true;
  } catch (e) {
    console.warn("[Integrations] MinIO init failed:", e.message);
  }
  try {
    await kafkaModule.connect();
    results.kafka = true;
  } catch (e) {
    console.warn("[Integrations] Kafka init failed:", e.message);
  }
  console.log("[Integrations] Initialization complete:", results);
  return results;
}

export default {
  neo4j: neo4jModule,
  elasticsearch: esModule,
  milvus: milvusModule,
  minio: minioModule,
  kafka: kafkaModule,
  keycloak,
  argocd,
  ocr,
  simulation,
  quality,
  healthCheckAll,
  initAll,
};