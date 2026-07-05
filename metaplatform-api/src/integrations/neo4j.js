/**
 * Neo4j Graph Database Integration
 *
 * Provides connection, query, and node management for the knowledge graph.
 * When NEO4J_URL is not configured, exports stub methods that log and return null.
 *
 * @module integrations/neo4j
 */

const NEO4J_URL = process.env.NEO4J_URL || '';
const NEO4J_USER = process.env.NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || '';

let driver = null;
let neo4j = null;

/**
 * Check if Neo4j is configured via environment variables
 * @returns {boolean}
 */
function isConfigured() {
  return Boolean(NEO4J_URL);
}

/**
 * Create a stub method that logs a message and returns null
 * @param {string} methodName
 * @returns {Function}
 */
function stub(methodName) {
  return (...args) => {
    console.warn(`[Neo4j] ${methodName}: Service not configured (NEO4J_URL is not set). Args:`, JSON.stringify(args));
    return null;
  };
}

/**
 * Connect to the Neo4j database
 * @returns {Promise<object|null>} The driver instance or null
 */
async function connect() {
  if (!isConfigured()) {
    console.warn('[Neo4j] connect: Service not configured (NEO4J_URL is not set)');
    return null;
  }

  try {
    // Dynamic require to avoid crash when driver is not installed
    if (!neo4j) {
      try {
        neo4j = require('neo4j-driver');
      } catch (e) {
        console.error('[Neo4j] neo4j-driver package not installed. Run: npm install neo4j-driver');
        return null;
      }
    }

    driver = neo4j.driver(
      NEO4J_URL,
      neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD),
      { maxConnectionPoolSize: 50, connectionAcquisitionTimeout: 30000 }
    );

    // Verify connectivity
    await driver.verifyConnectivity();
    console.log(`[Neo4j] Connected to ${NEO4J_URL}`);
    return driver;
  } catch (err) {
    console.error('[Neo4j] Connection failed:', err.message);
    driver = null;
    return null;
  }
}

/**
 * Execute a Cypher query against the Neo4j database
 * @param {string} cypher - The Cypher query string
 * @param {object} [params={}] - Query parameters
 * @returns {Promise<object[]|null>} Array of records or null
 */
async function queryGraph(cypher, params = {}) {
  if (!isConfigured()) {
    return stub('queryGraph')(cypher, params);
  }

  if (!driver) {
    await connect();
    if (!driver) return null;
  }

  const session = driver.session();
  try {
    const result = await session.run(cypher, params);
    return result.records.map((record) => record.toObject());
  } catch (err) {
    console.error('[Neo4j] queryGraph error:', err.message);
    throw err;
  } finally {
    await session.close();
  }
}

/**
 * Create a node in the knowledge graph
 * @param {string} label - Node label (e.g., 'Person', 'Concept')
 * @param {object} properties - Node properties
 * @returns {Promise<object|null>} The created node or null
 */
async function createNode(label, properties) {
  if (!isConfigured()) {
    return stub('createNode')(label, properties);
  }

  if (!driver) {
    await connect();
    if (!driver) return null;
  }

  const session = driver.session();
  try {
    const result = await session.run(
      `CREATE (n:${label} $props) RETURN n`,
      { props: properties }
    );
    return result.records[0]?.get('n').properties || null;
  } catch (err) {
    console.error('[Neo4j] createNode error:', err.message);
    throw err;
  } finally {
    await session.close();
  }
}

/**
 * Find relationships for a given node
 * @param {string} nodeId - The node ID or name
 * @param {string} [relType] - Optional relationship type filter
 * @returns {Promise<object[]|null>} Array of relationships or null
 */
async function findRelations(nodeId, relType) {
  if (!isConfigured()) {
    return stub('findRelations')(nodeId, relType);
  }

  if (!driver) {
    await connect();
    if (!driver) return null;
  }

  const session = driver.session();
  try {
    const relClause = relType ? `[r:${relType}]` : '[r]';
    const result = await session.run(
      `MATCH (n)-${relClause}-(m) WHERE id(n) = $nodeId OR n.name = $nodeId RETURN n, r, m`,
      { nodeId }
    );
    return result.records.map((record) => ({
      node: record.get('n').properties,
      relationship: {
        type: record.get('r').type,
        properties: record.get('r').properties,
      },
      related: record.get('m').properties,
    }));
  } catch (err) {
    console.error('[Neo4j] findRelations error:', err.message);
    throw err;
  } finally {
    await session.close();
  }
}

/**
 * Close the Neo4j driver connection
 * @returns {Promise<void>}
 */
async function close() {
  if (driver) {
    await driver.close();
    driver = null;
    console.log('[Neo4j] Connection closed');
  }
}

// Export real or stub methods based on configuration
if (isConfigured()) {
  module.exports = { connect, queryGraph, createNode, findRelations, close };
} else {
  module.exports = {
    connect: stub('connect'),
    queryGraph: stub('queryGraph'),
    createNode: stub('createNode'),
    findRelations: stub('findRelations'),
    close: stub('close'),
  };
}
