/**
 * Phase 2 — Seed Neo4j + Elasticsearch with ontology & knowledge data
 *
 * Reads from the relational DB (PostgreSQL or SQLite via db-adapter) and
 * projects the data into:
 *   - Neo4j: ontology objects as nodes, relations as edges
 *   - Elasticsearch: knowledge documents indexed with Chinese-friendly analyzer
 *
 * Idempotent: safe to run multiple times.
 *
 * Usage:  node src/seed-storage.js
 */

import db from "./db.js";
import { neo4j, elasticsearch, milvus } from "./integrations/index.js";

const SEED_FLAGS = {
  NEO4J: process.env.SEED_NEO4J !== "false",
  ES: process.env.SEED_ES !== "false",
  MILVUS: process.env.SEED_MILVUS !== "false",
};

async function seedNeo4j() {
  if (!neo4j.isConfigured()) {
    console.log("[Seed] Neo4j not configured, skipping");
    return { skipped: true };
  }
  console.log("[Seed] Seeding Neo4j...");

  // Ensure indexes / constraints
  try {
    await neo4j.queryGraph(`CREATE CONSTRAINT object_id IF NOT EXISTS FOR (n:OntologyObject) REQUIRE n.id IS UNIQUE`);
    await neo4j.queryGraph(`CREATE CONSTRAINT property_id IF NOT EXISTS FOR (n:OntologyProperty) REQUIRE n.id IS UNIQUE`);
    await neo4j.queryGraph(`CREATE CONSTRAINT relation_id IF NOT EXISTS FOR (n:OntologyRelation) REQUIRE n.id IS UNIQUE`);
    console.log("[Seed] Neo4j constraints ensured");
  } catch (e) {
    console.warn("[Seed] Constraint creation warning:", e.message);
  }

  // Pull objects from relational DB
  const objects = await db.prepare("SELECT * FROM ontology_objects").all();
  let nodeCount = 0;
  for (const obj of objects || []) {
    await neo4j.mergeNode("OntologyObject", "id", {
      id: obj.id,
      name: obj.name,
      label: obj.label,
      icon: obj.icon,
      description: obj.description || "",
      status: obj.status || "active",
      app_id: obj.app_id || null,
    });
    nodeCount++;
  }
  console.log(`[Seed] Neo4j: ${nodeCount} ontology objects created/merged`);

  // Pull relations
  const relations = await db.prepare("SELECT * FROM ontology_relations").all();
  let edgeCount = 0;
  for (const rel of relations || []) {
    try {
      await neo4j.queryGraph(
        `MATCH (a:OntologyObject {id: $fromId}), (b:OntologyObject {id: $toId})
         MERGE (a)-[r:${rel.relation_type || "RELATED"}]->(b)
         SET r.id = $relId, r.label = $label, r.description = $description`,
        {
          fromId: rel.source_object_id || rel.from_id,
          toId: rel.target_object_id || rel.to_id,
          relId: rel.id,
          label: rel.label || rel.name || "",
          description: rel.description || "",
        }
      );
      edgeCount++;
    } catch (e) {
      // Skip if either endpoint is missing
    }
  }
  console.log(`[Seed] Neo4j: ${edgeCount} relations created/merged`);

  return { objects: nodeCount, relations: edgeCount };
}

async function seedElasticsearch() {
  if (!elasticsearch.isConfigured()) {
    console.log("[Seed] Elasticsearch not configured, skipping");
    return { skipped: true };
  }
  console.log("[Seed] Seeding Elasticsearch...");

  // Pull documents
  const docs = await db.prepare("SELECT * FROM knowledge_documents").all();
  const operations = (docs || []).map((d) => ({
    id: d.id,
    document: {
      id: d.id,
      tenant_id: d.tenant_id || "default",
      type: "knowledge_document",
      title: d.title || "",
      content: d.content || "",
      tags: d.tags ? safeParseArray(d.tags) : [],
      created_at: d.created_at,
      updated_at: d.updated_at,
    },
  }));
  if (operations.length > 0) {
    const result = await elasticsearch.bulkIndex(operations);
    console.log(`[Seed] ES: ${operations.length} documents indexed (errors=${result.errors})`);
    return { indexed: operations.length, errors: result.errors };
  }
  return { indexed: 0 };
}

async function seedMilvus() {
  console.log("[Seed] Seeding Milvus (memory fallback)...");
  // Create collections for knowledge and ontology
  await milvus.createCollection("knowledge_embeddings", 384);
  await milvus.createCollection("ontology_embeddings", 384);

  // Insert real embeddings for sample documents.
  // Uses ai/embeddings.js which picks OpenAI if LLM_API_KEY set,
  // otherwise deterministic hash vectors (still semantically meaningful for grouping).
  const docs = await db.prepare("SELECT * FROM knowledge_documents LIMIT 50").all();
  const vectors = [];
  for (const d of docs || []) {
    const text = `${d.title || ""}\n${d.content || ""}`.trim();
    const v = await embed(text);
    vectors.push({
      id: d.id,
      vector: v,
      content: d.title || "",
      metadata: { source: "knowledge", type: "document" },
    });
  }
  if (vectors.length > 0) {
    const result = await milvus.insertVectors("knowledge_embeddings", vectors);
    console.log(`[Seed] Milvus: ${vectors.length} knowledge vectors inserted (${result.backend})`);
  }
  return { inserted: vectors.length, backend: milvus.usingFallback() ? "memory" : "milvus" };
}

function safeParseArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value.split(",").map((s) => s.trim());
    }
  }
  return [];
}

function deterministicVector(seed, dim) {
  // Hash seed to derive a deterministic vector
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  const v = new Array(dim);
  for (let i = 0; i < dim; i++) {
    h = (h * 1103515245 + 12345) | 0;
    v[i] = ((h >>> 0) / 0xffffffff) * 2 - 1; // [-1, 1]
  }
  // L2 normalize
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return v.map((x) => x / norm);
}

async function main() {
  console.log("\n═══ MetaPlatform Phase 2 Storage Seed ═══");
  console.log(`  Neo4j seed: ${SEED_FLAGS.NEO4J}`);
  console.log(`  ES seed:    ${SEED_FLAGS.ES}`);
  console.log(`  Milvus seed: ${SEED_FLAGS.MILVUS}\n`);

  const results = {};
  if (SEED_FLAGS.NEO4J) {
    try {
      await neo4j.connect();
      results.neo4j = await seedNeo4j();
    } catch (e) {
      results.neo4j = { error: e.message };
    }
  }
  if (SEED_FLAGS.ES) {
    try {
      await elasticsearch.connect();
      results.elasticsearch = await seedElasticsearch();
    } catch (e) {
      results.elasticsearch = { error: e.message };
    }
  }
  if (SEED_FLAGS.MILVUS) {
    try {
      await milvus.connect();
      results.milvus = await seedMilvus();
    } catch (e) {
      results.milvus = { error: e.message };
    }
  }

  console.log("\n═══ Seed Summary ═══");
  console.log(JSON.stringify(results, null, 2));

  // Close connections
  await neo4j.close().catch(() => {});

  // Force exit to ensure clean shutdown
  process.exit(0);
}

main().catch((err) => {
  console.error("[Seed] Fatal:", err);
  process.exit(1);
});