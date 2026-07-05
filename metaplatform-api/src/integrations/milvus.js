/**
 * Milvus Vector Database Integration
 *
 * Provides vector insertion, search, and collection management for RAG.
 * When MILVUS_URL is not configured, exports stub methods that log and return null.
 *
 * @module integrations/milvus
 */

const MILVUS_URL = process.env.MILVUS_URL || '';
const MILVUS_COLLECTION = process.env.MILVUS_COLLECTION || 'metaplatform_vectors';

let client = null;
let MilvusClient = null;

/**
 * Check if Milvus is configured via environment variables
 * @returns {boolean}
 */
function isConfigured() {
  return Boolean(MILVUS_URL);
}

/**
 * Create a stub method that logs a message and returns null
 * @param {string} methodName
 * @returns {Function}
 */
function stub(methodName) {
  return (...args) => {
    console.warn(`[Milvus] ${methodName}: Service not configured (MILVUS_URL is not set). Args:`, JSON.stringify(args.slice(0, 2)));
    return null;
  };
}

/**
 * Connect to the Milvus vector database
 * @returns {Promise<object|null>} The client instance or null
 */
async function connect() {
  if (!isConfigured()) {
    console.warn('[Milvus] connect: Service not configured (MILVUS_URL is not set)');
    return null;
  }

  try {
    if (!MilvusClient) {
      try {
        MilvusClient = require('@zilliz/milvus2-sdk-node').MilvusClient;
      } catch (e) {
        console.error('[Milvus] @zilliz/milvus2-sdk-node package not installed. Run: npm install @zilliz/milvus2-sdk-node');
        return null;
      }
    }

    client = new MilvusClient({ address: MILVUS_URL });

    // Verify connectivity
    const info = await client.checkHealth();
    console.log(`[Milvus] Connected to ${MILVUS_URL}, healthy: ${info.isHealthy}`);
    return client;
  } catch (err) {
    console.error('[Milvus] Connection failed:', err.message);
    client = null;
    return null;
  }
}

/**
 * Create a new collection in Milvus
 * @param {string} collectionName - The collection name
 * @param {number} dimension - Vector dimension
 * @param {object} [schema] - Additional schema fields
 * @returns {Promise<object|null>} Creation result or null
 */
async function createCollection(collectionName, dimension, schema = {}) {
  if (!isConfigured()) {
    return stub('createCollection')(collectionName, dimension, schema);
  }

  if (!client) {
    await connect();
    if (!client) return null;
  }

  try {
    const name = collectionName || MILVUS_COLLECTION;

    // Create collection with vector field
    const createParams = {
      collection_name: name,
      fields: [
        { name: 'id', data_type: 'VarChar', max_length: 128, is_primary_key: true },
        { name: 'vector', data_type: 'FloatVector', dim: dimension },
        { name: 'content', data_type: 'VarChar', max_length: 65535 },
        ...(schema.fields || []),
      ],
    };

    await client.createCollection(createParams);

    // Create index for vector field
    await client.createIndex({
      collection_name: name,
      field_name: 'vector',
      index_type: 'IVF_FLAT',
      metric_type: 'L2',
      params: { nlist: 128 },
    });

    console.log(`[Milvus] Collection '${name}' created with dimension ${dimension}`);
    return { collection: name, dimension };
  } catch (err) {
    console.error('[Milvus] createCollection error:', err.message);
    throw err;
  }
}

/**
 * Insert vectors into a collection
 * @param {string} collectionName - The collection name
 * @param {Array<{id: string, vector: number[], content: string}>} data - Vector data
 * @returns {Promise<object|null>} Insertion result or null
 */
async function insertVectors(collectionName, data) {
  if (!isConfigured()) {
    return stub('insertVectors')(collectionName, data);
  }

  if (!client) {
    await connect();
    if (!client) return null;
  }

  try {
    const name = collectionName || MILVUS_COLLECTION;

    const result = await client.insert({
      collection_name: name,
      data: data.map((d) => ({
        id: d.id,
        vector: d.vector,
        content: d.content || '',
      })),
    });

    console.log(`[Milvus] Inserted ${data.length} vectors into '${name}'`);
    return result;
  } catch (err) {
    console.error('[Milvus] insertVectors error:', err.message);
    throw err;
  }
}

/**
 * Search for similar vectors in a collection
 * @param {string} collectionName - The collection name
 * @param {number[]} vector - The query vector
 * @param {object} [options] - Search options (topK, filter)
 * @returns {Promise<object[]|null>} Search results or null
 */
async function search(collectionName, vector, options = {}) {
  if (!isConfigured()) {
    return stub('search')(collectionName, vector, options);
  }

  if (!client) {
    await connect();
    if (!client) return null;
  }

  try {
    const name = collectionName || MILVUS_COLLECTION;
    const topK = options.topK || 10;

    const result = await client.search({
      collection_name: name,
      vectors: [vector],
      limit: topK,
      output_fields: ['id', 'content'],
      ...(options.filter ? { filter: options.filter } : {}),
    });

    return (result.results || []).map((r) => ({
      id: r.id,
      score: r.score,
      content: r.content || '',
    }));
  } catch (err) {
    console.error('[Milvus] search error:', err.message);
    throw err;
  }
}

// Export real or stub methods based on configuration
if (isConfigured()) {
  module.exports = { connect, insertVectors, search, createCollection };
} else {
  module.exports = {
    connect: stub('connect'),
    insertVectors: stub('insertVectors'),
    search: stub('search'),
    createCollection: stub('createCollection'),
  };
}
