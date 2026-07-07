/**
 * Elasticsearch Full-Text Search Integration (ESM)
 *
 * Phase 2: Storage Layer Upgrade — Production-grade full-text search.
 *
 * Provides indexing, searching, and index management.
 * When ELASTICSEARCH_URL is not configured, exports stub methods that log and return null.
 */

const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL || "";
const ELASTICSEARCH_INDEX = process.env.ELASTICSEARCH_INDEX || "metaplatform";

let client = null;
let ClientClass = null;
let connected = false;

export function isConfigured() {
  return Boolean(ELASTICSEARCH_URL);
}

function stub(methodName) {
  return (...args) => {
    console.warn(`[Elasticsearch] ${methodName}: Service not configured. Args:`, JSON.stringify(args.slice(0, 2)));
    return null;
  };
}

/**
 * Connect to Elasticsearch and ensure default index exists with mapping
 */
export async function connect() {
  if (!isConfigured()) {
    console.warn("[Elasticsearch] connect: Service not configured");
    return null;
  }
  if (client && connected) return client;

  try {
    if (!ClientClass) {
      try {
        const mod = await import("@elastic/elasticsearch");
        ClientClass = mod.Client;
      } catch (e) {
        console.error("[Elasticsearch] @elastic/elasticsearch package not installed.");
        return null;
      }
    }

    // The @elastic/elasticsearch client v9 sends "compatible-with=9" by default.
// For ES 8.x server, we need compatible-with=8.
// Pass via the lower-level transport option to avoid header collision.
client = new ClientClass({
  node: ELASTICSEARCH_URL,
  transport: undefined, // default
});

    // Verify connectivity
    const health = await client.cluster.health();
    console.log(`[Elasticsearch] Connected to ${ELASTICSEARCH_URL}, status: ${health.status}`);

    // Ensure default index exists with IK analyzer (Chinese-friendly)
    const indexExists = await client.indices.exists({ index: ELASTICSEARCH_INDEX });
    if (!indexExists) {
      await client.indices.create({
        index: ELASTICSEARCH_INDEX,
        settings: {
          number_of_shards: 1,
          number_of_replicas: 0,
          analysis: {
            analyzer: {
              default: {
                type: "standard",
              },
              // Lightweight Chinese-friendly analyzer (no plugin needed)
              chinese_simple: {
                tokenizer: "standard",
                filter: ["lowercase"],
              },
            },
          },
        },
        mappings: {
          properties: {
            id: { type: "keyword" },
            tenant_id: { type: "keyword" },
            type: { type: "keyword" },
            title: {
              type: "text",
              analyzer: "chinese_simple",
              fields: { keyword: { type: "keyword", ignore_above: 256 } },
            },
            content: { type: "text", analyzer: "chinese_simple" },
            tags: { type: "keyword" },
            created_at: { type: "date" },
            updated_at: { type: "date" },
          },
        },
      });
      console.log(`[Elasticsearch] Created index '${ELASTICSEARCH_INDEX}'`);
    }

    connected = true;
    return client;
  } catch (err) {
    console.error("[Elasticsearch] Connection failed:", err.message);
    client = null;
    connected = false;
    return null;
  }
}

/**
 * Index a document
 */
export async function indexDocument(index, id, body) {
  if (!isConfigured()) return stub("indexDocument")(index, id, body);
  if (!client) {
    await connect();
    if (!client) return null;
  }
  try {
    const result = await client.index({
      index: index || ELASTICSEARCH_INDEX,
      id,
      document: body,
      refresh: "wait_for",
    });
    return { _id: result._id, _index: result._index, result: result.result };
  } catch (err) {
    console.error("[Elasticsearch] indexDocument error:", err.message);
    throw err;
  }
}

/**
 * Bulk index multiple documents
 */
export async function bulkIndex(operations) {
  if (!isConfigured()) return stub("bulkIndex")(operations);
  if (!client) {
    await connect();
    if (!client) return null;
  }
  try {
    const body = operations.flatMap((op) => [
      { index: { _index: op.index || ELASTICSEARCH_INDEX, _id: op.id } },
      op.document,
    ]);
    const result = await client.bulk({ operations: body, refresh: "wait_for" });
    return {
      took: result.took,
      errors: result.errors,
      items: result.items,
    };
  } catch (err) {
    console.error("[Elasticsearch] bulkIndex error:", err.message);
    throw err;
  }
}

/**
 * Multi-match search across title and content fields
 */
export async function searchText(query, options = {}) {
  if (!isConfigured()) return stub("searchText")(query, options);
  if (!client) {
    await connect();
    if (!client) return null;
  }
  try {
    const result = await client.search({
      index: options.index || ELASTICSEARCH_INDEX,
      size: options.size || 20,
      from: options.from || 0,
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query,
                fields: ["title^3", "content", "tags^2"],
                type: "best_fields",
                fuzziness: "AUTO",
              },
            },
          ],
          ...(options.filter
            ? { filter: [options.filter] }
            : {}),
        },
      },
      ...(options.sort ? { sort: options.sort } : {}),
      highlight: {
        fields: { content: {}, title: {} },
        pre_tags: ["<mark>"],
        post_tags: ["</mark>"],
      },
    });

    const total =
      typeof result.hits.total === "object"
        ? result.hits.total.value
        : result.hits.total;

    return {
      total,
      hits: result.hits.hits.map((hit) => ({
        id: hit._id,
        index: hit._index,
        score: hit._score,
        source: hit._source,
        highlight: hit.highlight || {},
      })),
    };
  } catch (err) {
    console.error("[Elasticsearch] searchText error:", err.message);
    throw err;
  }
}

/**
 * Generic search with raw query DSL
 */
export async function search(index, query, options = {}) {
  if (!isConfigured()) return stub("search")(index, query, options);
  if (!client) {
    await connect();
    if (!client) return null;
  }
  try {
    const result = await client.search({
      index: index || ELASTICSEARCH_INDEX,
      size: options.size || 20,
      from: options.from || 0,
      query,
      ...(options.sort ? { sort: options.sort } : {}),
    });

    const total =
      typeof result.hits.total === "object"
        ? result.hits.total.value
        : result.hits.total;

    return {
      total,
      hits: result.hits.hits.map((hit) => ({
        id: hit._id,
        score: hit._score,
        source: hit._source,
      })),
    };
  } catch (err) {
    console.error("[Elasticsearch] search error:", err.message);
    throw err;
  }
}

/**
 * Delete a document by id
 */
export async function deleteDocument(index, id) {
  if (!isConfigured()) return stub("deleteDocument")(index, id);
  if (!client) {
    await connect();
    if (!client) return null;
  }
  try {
    return await client.delete({
      index: index || ELASTICSEARCH_INDEX,
      id,
      refresh: "wait_for",
    });
  } catch (err) {
    if (err.meta?.statusCode === 404) return { result: "not_found" };
    console.error("[Elasticsearch] deleteDocument error:", err.message);
    throw err;
  }
}

/**
 * Delete an entire index
 */
export async function deleteIndex(index) {
  if (!isConfigured()) return stub("deleteIndex")(index);
  if (!client) {
    await connect();
    if (!client) return null;
  }
  try {
    const result = await client.indices.delete({
      index: index || ELASTICSEARCH_INDEX,
    });
    console.log(`[Elasticsearch] Index '${index || ELASTICSEARCH_INDEX}' deleted`);
    return result;
  } catch (err) {
    console.error("[Elasticsearch] deleteIndex error:", err.message);
    throw err;
  }
}

/**
 * Health check
 */
export async function healthCheck() {
  if (!isConfigured()) return { status: "disabled" };
  return Promise.race([
    _esHealthInner(),
    new Promise((resolve) =>
      setTimeout(() => resolve({ status: "timeout", after: "5s" }), 5000)
    ),
  ]);
}

async function _esHealthInner() {
  try {
    if (!client) await connect();
    if (!client) return { status: "unreachable" };
    const health = await client.cluster.health();
    return {
      status: health.status,
      url: ELASTICSEARCH_URL,
      index: ELASTICSEARCH_INDEX,
    };
  } catch (err) {
    return { status: "error", error: err.message };
  }
}

export default {
  isConfigured,
  connect,
  indexDocument,
  bulkIndex,
  searchText,
  search,
  deleteDocument,
  deleteIndex,
  healthCheck,
};