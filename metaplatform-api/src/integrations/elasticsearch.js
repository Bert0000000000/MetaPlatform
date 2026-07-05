/**
 * Elasticsearch Full-Text Search Integration
 *
 * Provides indexing, searching, and index management for full-text search.
 * When ELASTICSEARCH_URL is not configured, exports stub methods that log and return null.
 *
 * @module integrations/elasticsearch
 */

const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL || '';
const ELASTICSEARCH_INDEX = process.env.ELASTICSEARCH_INDEX || 'metaplatform';

let client = null;
let Client = null;

/**
 * Check if Elasticsearch is configured via environment variables
 * @returns {boolean}
 */
function isConfigured() {
  return Boolean(ELASTICSEARCH_URL);
}

/**
 * Create a stub method that logs a message and returns null
 * @param {string} methodName
 * @returns {Function}
 */
function stub(methodName) {
  return (...args) => {
    console.warn(`[Elasticsearch] ${methodName}: Service not configured (ELASTICSEARCH_URL is not set). Args:`, JSON.stringify(args.slice(0, 2)));
    return null;
  };
}

/**
 * Connect to Elasticsearch
 * @returns {Promise<object|null>} The client instance or null
 */
async function connect() {
  if (!isConfigured()) {
    console.warn('[Elasticsearch] connect: Service not configured (ELASTICSEARCH_URL is not set)');
    return null;
  }

  try {
    if (!Client) {
      try {
        Client = require('@elastic/elasticsearch').Client;
      } catch (e) {
        console.error('[Elasticsearch] @elastic/elasticsearch package not installed. Run: npm install @elastic/elasticsearch');
        return null;
      }
    }

    client = new Client({ node: ELASTICSEARCH_URL });

    // Verify connectivity
    const health = await client.cluster.health();
    console.log(`[Elasticsearch] Connected to ${ELASTICSEARCH_URL}, cluster status: ${health.status}`);
    return client;
  } catch (err) {
    console.error('[Elasticsearch] Connection failed:', err.message);
    client = null;
    return null;
  }
}

/**
 * Index a document into Elasticsearch
 * @param {string} index - The index name (defaults to configured index)
 * @param {string} id - Document ID
 * @param {object} body - Document body
 * @returns {Promise<object|null>} Index result or null
 */
async function indexDocument(index, id, body) {
  if (!isConfigured()) {
    return stub('indexDocument')(index, id, body);
  }

  if (!client) {
    await connect();
    if (!client) return null;
  }

  try {
    const result = await client.index({
      index: index || ELASTICSEARCH_INDEX,
      id,
      body,
      refresh: 'wait_for',
    });
    return result;
  } catch (err) {
    console.error('[Elasticsearch] indexDocument error:', err.message);
    throw err;
  }
}

/**
 * Search documents in Elasticsearch
 * @param {string} index - The index name (defaults to configured index)
 * @param {object} query - Elasticsearch query DSL
 * @param {object} [options] - Additional options (size, from, sort)
 * @returns {Promise<object[]|null>} Search results or null
 */
async function search(index, query, options = {}) {
  if (!isConfigured()) {
    return stub('search')(index, query, options);
  }

  if (!client) {
    await connect();
    if (!client) return null;
  }

  try {
    const result = await client.search({
      index: index || ELASTICSEARCH_INDEX,
      body: {
        query,
        size: options.size || 20,
        from: options.from || 0,
        ...(options.sort ? { sort: options.sort } : {}),
      },
    });

    return {
      total: result.hits.total.value || result.hits.total,
      hits: result.hits.hits.map((hit) => ({
        id: hit._id,
        score: hit._score,
        source: hit._source,
      })),
    };
  } catch (err) {
    console.error('[Elasticsearch] search error:', err.message);
    throw err;
  }
}

/**
 * Delete an Elasticsearch index
 * @param {string} index - The index name to delete
 * @returns {Promise<object|null>} Deletion result or null
 */
async function deleteIndex(index) {
  if (!isConfigured()) {
    return stub('deleteIndex')(index);
  }

  if (!client) {
    await connect();
    if (!client) return null;
  }

  try {
    const result = await client.indices.delete({
      index: index || ELASTICSEARCH_INDEX,
      ignore_unavailable: true,
    });
    console.log(`[Elasticsearch] Index '${index || ELASTICSEARCH_INDEX}' deleted`);
    return result;
  } catch (err) {
    console.error('[Elasticsearch] deleteIndex error:', err.message);
    throw err;
  }
}

// Export real or stub methods based on configuration
if (isConfigured()) {
  module.exports = { connect, indexDocument, search, deleteIndex };
} else {
  module.exports = {
    connect: stub('connect'),
    indexDocument: stub('indexDocument'),
    search: stub('search'),
    deleteIndex: stub('deleteIndex'),
  };
}
