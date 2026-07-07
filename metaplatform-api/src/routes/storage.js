/**
 * /api/storage — Unified storage layer endpoints (Phase 2)
 *
 * Exposes Neo4j, Elasticsearch, Milvus, MinIO, and Kafka operations
 * through a single REST surface so the frontend can interact with
 * the production storage backends without needing to know which
 * subsystem owns each operation.
 *
 *   GET    /api/storage/health           — all backends health
 *   POST   /api/storage/neo4j/query      — execute raw Cypher
 *   POST   /api/storage/neo4j/node       — create/merge a node
 *   GET    /api/storage/neo4j/subgraph/:id?depth=N
 *   POST   /api/storage/es/search        — full-text search
 *   POST   /api/storage/es/index         — index a document
 *   DELETE /api/storage/es/:id           — delete a doc
 *   POST   /api/storage/milvus/insert    — insert vectors
 *   POST   /api/storage/milvus/search    — top-K similarity search
 *   GET    /api/storage/milvus/collections
 *   POST   /api/storage/minio/upload     — multipart file upload
 *   GET    /api/storage/minio/url/:name  — presigned GET URL
 *   GET    /api/storage/minio/list       — list objects
 *   POST   /api/storage/kafka/publish    — publish event
 *   GET    /api/storage/kafka/topics     — list topics
 */
import { Router } from "express";
import multer from "multer";
import { v4 as uuid } from "uuid";
import {
  neo4j,
  elasticsearch,
  milvus,
  minio,
  kafka,
  healthCheckAll,
} from "../integrations/index.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// ════════════════════════════════════════════════════════
//  Health
// ════════════════════════════════════════════════════════
router.get("/health", async (_req, res, next) => {
  try {
    const h = await healthCheckAll();
    res.json({ success: true, data: h });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════
//  Neo4j — Graph queries
// ════════════════════════════════════════════════════════

// POST /neo4j/query — execute Cypher (admin/operator only)
router.post("/neo4j/query", async (req, res, next) => {
  try {
    const { cypher, params = {} } = req.body;
    if (!cypher) return res.status(400).json({ success: false, error: "cypher 为必填项" });
    const rows = await neo4j.queryGraph(cypher, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// POST /neo4j/node — create or merge a graph node
router.post("/neo4j/node", async (req, res, next) => {
  try {
    const { label, properties = {}, uniqueKey = "id" } = req.body;
    if (!label) return res.status(400).json({ success: false, error: "label 为必填项" });
    if (!properties.id) properties.id = uuid();
    const result = await neo4j.mergeNode(label, uniqueKey, properties);
    await kafka.emitOntologyUpdated({ id: properties.id, label, source: "api" });
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// POST /neo4j/relation — create a relationship between two nodes
router.post("/neo4j/relation", async (req, res, next) => {
  try {
    const { fromId, toId, type, properties = {} } = req.body;
    if (!fromId || !toId || !type) {
      return res.status(400).json({ success: false, error: "fromId, toId, type 为必填项" });
    }
    const cypher = `MATCH (a {id: $fromId}), (b {id: $toId})
                    MERGE (a)-[r:${type}]->(b)
                    SET r += $props
                    RETURN a.id AS from, b.id AS to, type(r) AS type, properties(r) AS props`;
    const rows = await neo4j.queryGraph(cypher, { fromId, toId, props: properties });
    res.status(201).json({ success: true, data: rows[0] || null });
  } catch (err) {
    next(err);
  }
});

// GET /neo4j/subgraph/:id — get N-hop subgraph
router.get("/neo4j/subgraph/:id", async (req, res, next) => {
  try {
    const depth = Math.min(parseInt(req.query.depth || "2", 10), 5);
    const limit = Math.min(parseInt(req.query.limit || "100", 10), 500);
    const data = await neo4j.getSubgraph(req.params.id, depth, limit);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /neo4j/relations/:id — find relations for a node
router.get("/neo4j/relations/:id", async (req, res, next) => {
  try {
    const { type, direction } = req.query;
    const data = await neo4j.findRelations(req.params.id, type, direction);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// DELETE /neo4j/node/:id — delete node (cascade)
router.delete("/neo4j/node/:id", async (req, res, next) => {
  try {
    const deleted = await neo4j.deleteNode(req.params.id);
    res.json({ success: true, data: { deleted } });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════
//  Elasticsearch — Full-text search
// ════════════════════════════════════════════════════════

// POST /es/search — multi-field text search
router.post("/es/search", async (req, res, next) => {
  try {
    const { query, index, size, from, filter, sort } = req.body;
    if (!query) return res.status(400).json({ success: false, error: "query 为必填项" });
    const data = await elasticsearch.searchText(query, { index, size, from, filter, sort });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// POST /es/index — index a single document
router.post("/es/index", async (req, res, next) => {
  try {
    const { id, document, index } = req.body;
    if (!id || !document) return res.status(400).json({ success: false, error: "id, document 为必填项" });
    const docId = id || uuid();
    const data = await elasticsearch.indexDocument(index, docId, document);
    res.status(201).json({ success: true, data: { ...data, id: docId } });
  } catch (err) {
    next(err);
  }
});

// POST /es/bulk — bulk index documents
router.post("/es/bulk", async (req, res, next) => {
  try {
    const { operations } = req.body;
    if (!Array.isArray(operations) || operations.length === 0) {
      return res.status(400).json({ success: false, error: "operations 数组为必填项" });
    }
    const data = await elasticsearch.bulkIndex(operations);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// DELETE /es/:id — delete a document
router.delete("/es/:id", async (req, res, next) => {
  try {
    const { index } = req.query;
    const data = await elasticsearch.deleteDocument(index, req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════
//  Milvus — Vector search
// ════════════════════════════════════════════════════════

// POST /milvus/collection — create collection
router.post("/milvus/collection", async (req, res, next) => {
  try {
    const { name, dimension } = req.body;
    if (!name) return res.status(400).json({ success: false, error: "name 为必填项" });
    const data = await milvus.createCollection(name, dimension || 384);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// POST /milvus/insert — insert vectors
router.post("/milvus/insert", async (req, res, next) => {
  try {
    const { collection, items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: "items 数组为必填项" });
    }
    const data = await milvus.insertVectors(collection, items);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// POST /milvus/search — top-K similarity search
router.post("/milvus/search", async (req, res, next) => {
  try {
    const { collection, vector, topK = 10, filter, minScore } = req.body;
    if (!Array.isArray(vector)) {
      return res.status(400).json({ success: false, error: "vector 数组为必填项" });
    }
    const data = await milvus.search(collection, vector, { topK, filter, minScore });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /milvus/collections — list collections
router.get("/milvus/collections", async (_req, res, next) => {
  try {
    const data = await milvus.listCollections();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// DELETE /milvus/collection/:name — drop collection
router.delete("/milvus/collection/:name", async (req, res, next) => {
  try {
    const data = await milvus.dropCollection(req.params.name);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════
//  MinIO — Object storage
// ════════════════════════════════════════════════════════

// POST /minio/upload — multipart file upload
router.post("/minio/upload", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: "file 为必填项" });
    const objectName = `${req.body.prefix || "uploads"}/${Date.now()}-${req.file.originalname}`;
    const data = await minio.uploadFile(objectName, req.file.buffer, {
      contentType: req.file.mimetype,
      metadata: { originalName: req.file.originalname, size: String(req.file.size) },
    });
    await kafka.emitFileUploaded({ objectName, size: req.file.size, contentType: req.file.mimetype });
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /minio/url/:objectName — presigned GET URL
router.get("/minio/url/*", async (req, res, next) => {
  try {
    const objectName = decodeURIComponent(req.params[0] || "");
    const expiry = parseInt(req.query.expiry || "3600", 10);
    const url = await minio.getPresignedUrl("GET", objectName, expiry);
    res.json({ success: true, data: { url, objectName, expiry } });
  } catch (err) {
    next(err);
  }
});

// GET /minio/list — list objects with prefix
router.get("/minio/list", async (req, res, next) => {
  try {
    const { prefix, recursive } = req.query;
    const data = await minio.listObjects(prefix || "", recursive === "true");
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// DELETE /minio/:objectName — delete object
router.delete("/minio/*", async (req, res, next) => {
  try {
    const objectName = decodeURIComponent(req.params[0] || "");
    const data = await minio.deleteFile(objectName);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════
//  Kafka — Event bus
// ════════════════════════════════════════════════════════

// POST /kafka/publish — publish event
router.post("/kafka/publish", async (req, res, next) => {
  try {
    const { topic, key, value, headers } = req.body;
    if (!topic) return res.status(400).json({ success: false, error: "topic 为必填项" });
    const data = await kafka.publish(topic, { key, value, headers });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /kafka/topics — list Kafka topics (admin)
router.get("/kafka/topics", async (_req, res, next) => {
  try {
    const data = await kafka.healthCheck();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// POST /kafka/subscribe — start a consumer (returns immediately; consumer runs in background)
router.post("/kafka/subscribe", async (req, res, next) => {
  try {
    const { topics, groupId, fromBeginning } = req.body;
    if (!topics) return res.status(400).json({ success: false, error: "topics 为必填项" });
    const topicList = Array.isArray(topics) ? topics : [topics];

    // Background consumer that simply logs received messages.
    // In production this would route events to domain handlers.
    const unsubscribe = await kafka.subscribe(topicList, async (msg) => {
      console.log(`[Kafka Consumer] topic=${msg.topic} key=${msg.key} value=${JSON.stringify(msg.value)}`);
    }, { groupId, fromBeginning: !!fromBeginning });

    // Auto-unsubscribe after 30 minutes if not stopped manually
    setTimeout(() => {
      unsubscribe().catch(() => {});
    }, 30 * 60 * 1000);

    res.status(201).json({ success: true, data: { subscribed: topicList, groupId } });
  } catch (err) {
    next(err);
  }
});

export default router;