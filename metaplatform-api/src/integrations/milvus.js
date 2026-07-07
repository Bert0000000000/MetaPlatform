/**
 * Milvus Vector Database Integration (ESM)
 *
 * Phase 2: Storage Layer Upgrade — Production-grade vector search.
 *
 * Strategy:
 *   - If MILVUS_URL is reachable AND @zilliz/milvus2-sdk-node is installed,
 *     use the official Milvus client.
 *   - Otherwise, fall back to an in-process cosine similarity index
 *     (pure-JS Float32Array implementation) — fully functional for
 *     moderate-scale (< 100k vectors) deployments.
 *
 * The fallback keeps the platform running when Milvus standalone (which
 * requires etcd + minio + standalone containers) is not available, while
 * preserving the same API surface for callers.
 */

const MILVUS_URL = process.env.MILVUS_URL || "";
const MILVUS_COLLECTION = process.env.MILVUS_COLLECTION || "metaplatform_vectors";
const EMBEDDING_DIM = parseInt(process.env.EMBEDDING_DIM || "384", 10);

let sdkClient = null;
let sdkReady = false;
let MilvusSDK = null;

// ── Fallback in-memory store ──────────────────────────────────
const memoryStore = new Map(); // collection -> { id -> { id, vector, content, metadata } }

function ensureMemoryCollection(name) {
  if (!memoryStore.has(name)) {
    memoryStore.set(name, new Map());
  }
  return memoryStore.get(name);
}

function cosineSimilarity(a, b) {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export function isConfigured() {
  // Always "configured" — we always have the fallback.
  // The SDK mode is activated on connect() if MILVUS_URL is reachable.
  return true;
}

export function usingFallback() {
  return !sdkReady;
}

function stub(methodName) {
  return (...args) => {
    console.warn(`[Milvus] ${methodName}: fallback error. Args:`, JSON.stringify(args.slice(0, 2)));
    return null;
  };
}

/**
 * Try to connect to real Milvus SDK. If it fails, stay on the in-memory fallback.
 */
export async function connect() {
  if (!MILVUS_URL) {
    console.log("[Milvus] MILVUS_URL not set — using in-memory cosine-similarity fallback (dim=" + EMBEDDING_DIM + ")");
    return null;
  }

  if (sdkReady) return sdkClient;

  try {
    if (!MilvusSDK) {
      try {
        const mod = await import("@zilliz/milvus2-sdk-node");
        MilvusSDK = mod.MilvusClient;
      } catch (e) {
        console.warn("[Milvus] @zilliz/milvus2-sdk-node not installed — falling back to in-memory index");
        return null;
      }
    }

    sdkClient = new MilvusSDK({ address: MILVUS_URL });
    const health = await sdkClient.checkHealth();
    if (health.isHealthy) {
      sdkReady = true;
      console.log(`[Milvus] Connected to ${MILVUS_URL}`);
      return sdkClient;
    }
    sdkClient = null;
    return null;
  } catch (err) {
    console.warn(`[Milvus] SDK connect failed (${err.message}) — using in-memory fallback`);
    sdkClient = null;
    return null;
  }
}

/**
 * Create a collection in Milvus (or initialize in-memory store).
 */
export async function createCollection(collectionName, dimension, schema = {}) {
  const name = collectionName || MILVUS_COLLECTION;
  const dim = dimension || EMBEDDING_DIM;

  if (sdkReady) {
    try {
      const createParams = {
        collection_name: name,
        fields: [
          { name: "id", data_type: "VarChar", max_length: 128, is_primary_key: true },
          { name: "vector", data_type: "FloatVector", dim: dim },
          { name: "content", data_type: "VarChar", max_length: 65535 },
          ...(schema.fields || []),
        ],
      };
      await sdkClient.createCollection(createParams);
      await sdkClient.createIndex({
        collection_name: name,
        field_name: "vector",
        index_type: "IVF_FLAT",
        metric_type: "L2",
        params: { nlist: 128 },
      });
      return { collection: name, dimension: dim, backend: "milvus" };
    } catch (err) {
      console.error("[Milvus] createCollection error:", err.message);
      throw err;
    }
  }

  ensureMemoryCollection(name);
  return { collection: name, dimension: dim, backend: "memory" };
}

/**
 * Insert vectors into a collection
 */
export async function insertVectors(collectionName, data) {
  const name = collectionName || MILVUS_COLLECTION;

  if (sdkReady) {
    try {
      const result = await sdkClient.insert({
        collection_name: name,
        data: data.map((d) => ({
          id: d.id,
          vector: d.vector,
          content: d.content || "",
        })),
      });
      return { ...result, backend: "milvus" };
    } catch (err) {
      console.error("[Milvus] insertVectors error:", err.message);
      throw err;
    }
  }

  const store = ensureMemoryCollection(name);
  for (const d of data) {
    store.set(d.id, { id: d.id, vector: d.vector, content: d.content || "", metadata: d.metadata || {} });
  }
  return { inserted: data.length, collection: name, backend: "memory" };
}

/**
 * Search for top-K similar vectors (cosine similarity in fallback)
 */
export async function search(collectionName, vector, options = {}) {
  const name = collectionName || MILVUS_COLLECTION;
  const topK = options.topK || 10;
  const minScore = options.minScore || -1; // cosine range: [-1, 1]

  if (sdkReady) {
    try {
      const result = await sdkClient.search({
        collection_name: name,
        vectors: [vector],
        limit: topK,
        output_fields: ["id", "content"],
        ...(options.filter ? { filter: options.filter } : {}),
      });
      return (result.results || []).map((r) => ({
        id: r.id,
        score: r.score,
        content: r.content || "",
        backend: "milvus",
      }));
    } catch (err) {
      console.error("[Milvus] search error:", err.message);
      throw err;
    }
  }

  const store = ensureMemoryCollection(name);
  const scored = [];
  for (const item of store.values()) {
    const score = cosineSimilarity(vector, item.vector);
    if (score >= minScore) scored.push({ ...item, score });
  }
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, topK);
  return top.map(({ id, score, content, metadata }) => ({ id, score, content, metadata, backend: "memory" }));
}

/**
 * List all collections (and stats)
 */
export async function listCollections() {
  if (sdkReady) {
    try {
      const result = await sdkClient.showCollections();
      return result.data || [];
    } catch (err) {
      console.error("[Milvus] listCollections error:", err.message);
      throw err;
    }
  }
  return [...memoryStore.keys()].map((name) => ({
    name,
    rowCount: memoryStore.get(name).size,
    backend: "memory",
  }));
}

/**
 * Delete a collection
 */
export async function dropCollection(collectionName) {
  const name = collectionName || MILVUS_COLLECTION;
  if (sdkReady) {
    try {
      await sdkClient.dropCollection({ collection_name: name });
      return { dropped: true, backend: "milvus" };
    } catch (err) {
      console.error("[Milvus] dropCollection error:", err.message);
      throw err;
    }
  }
  memoryStore.delete(name);
  return { dropped: true, backend: "memory" };
}

/**
 * Health check
 */
export async function healthCheck() {
  if (sdkReady) {
    try {
      const h = await sdkClient.checkHealth();
      return { status: h.isHealthy ? "connected" : "unhealthy", url: MILVUS_URL, backend: "milvus" };
    } catch (err) {
      return { status: "error", error: err.message, backend: "milvus" };
    }
  }
  return {
    status: "connected",
    backend: "memory",
    collections: memoryStore.size,
    totalVectors: [...memoryStore.values()].reduce((acc, m) => acc + m.size, 0),
    dimension: EMBEDDING_DIM,
    note: "Milvus SDK not reachable — using in-process cosine-similarity index",
  };
}

export { cosineSimilarity };

export default {
  isConfigured,
  usingFallback,
  connect,
  createCollection,
  insertVectors,
  search,
  listCollections,
  dropCollection,
  healthCheck,
  cosineSimilarity,
};