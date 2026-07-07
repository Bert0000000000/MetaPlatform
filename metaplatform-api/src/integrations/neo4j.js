/**
 * Neo4j Graph Database Integration (ESM)
 *
 * Phase 2: Storage Layer Upgrade — Production-grade ontology engine.
 *
 * Provides connection, query, and node management for the knowledge graph.
 * When NEO4J_URL is not configured, exports stub methods that log and return null.
 */

const NEO4J_URL = process.env.NEO4J_URL || "";
const NEO4J_USER = process.env.NEO4J_USER || "neo4j";
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || "";
const NEO4J_DATABASE = process.env.NEO4J_DATABASE || "neo4j";

let driver = null;
let neo4jLib = null;
let connected = false;

/**
 * Check if Neo4j is configured via environment variables
 */
export function isConfigured() {
  return Boolean(NEO4J_URL);
}

/**
 * Create a stub method that logs a message and returns null
 */
function stub(methodName) {
  return (...args) => {
    console.warn(`[Neo4j] ${methodName}: Service not configured (NEO4J_URL is not set). Args:`, JSON.stringify(args.slice(0, 2)));
    return null;
  };
}

/**
 * Connect to the Neo4j database
 */
export async function connect() {
  if (!isConfigured()) {
    console.warn("[Neo4j] connect: Service not configured (NEO4J_URL is not set)");
    return null;
  }

  if (driver && connected) return driver;

  try {
    if (!neo4jLib) {
      try {
        neo4jLib = await import("neo4j-driver");
      } catch (e) {
        console.error("[Neo4j] neo4j-driver package not installed. Run: npm install neo4j-driver");
        return null;
      }
    }

    driver = neo4jLib.default.driver(
      NEO4J_URL,
      neo4jLib.default.auth.basic(NEO4J_USER, NEO4J_PASSWORD),
      {
        maxConnectionPoolSize: 50,
        connectionAcquisitionTimeout: 30000,
        disableLosslessIntegers: true,
      }
    );

    // Verify connectivity
    await driver.verifyConnectivity();
    connected = true;
    console.log(`[Neo4j] Connected to ${NEO4J_URL} (db=${NEO4J_DATABASE})`);
    return driver;
  } catch (err) {
    console.error("[Neo4j] Connection failed:", err.message);
    driver = null;
    connected = false;
    return null;
  }
}

/**
 * Execute a Cypher query against the Neo4j database
 */
export async function queryGraph(cypher, params = {}) {
  if (!isConfigured()) return stub("queryGraph")(cypher, params);
  if (!driver) {
    await connect();
    if (!driver) return null;
  }

  const session = driver.session({ database: NEO4J_DATABASE });
  try {
    const result = await session.run(cypher, params);
    return result.records.map((record) => record.toObject());
  } catch (err) {
    console.error("[Neo4j] queryGraph error:", err.message);
    throw err;
  } finally {
    await session.close();
  }
}

/**
 * Run a unit of work within a transaction
 */
export async function transaction(work) {
  if (!isConfigured()) return stub("transaction")();
  if (!driver) {
    await connect();
    if (!driver) return null;
  }
  const session = driver.session({ database: NEO4J_DATABASE });
  try {
    return await session.executeWrite(work);
  } finally {
    await session.close();
  }
}

/**
 * Create a node in the knowledge graph
 */
export async function createNode(label, properties) {
  if (!isConfigured()) return stub("createNode")(label, properties);
  if (!driver) {
    await connect();
    if (!driver) return null;
  }
  const session = driver.session({ database: NEO4J_DATABASE });
  try {
    const result = await session.run(`CREATE (n:${label} $props) RETURN n, id(n) AS _id`, {
      props: properties,
    });
    const record = result.records[0];
    if (!record) return null;
    return { id: record.get("_id"), properties: record.get("n").properties };
  } catch (err) {
    console.error("[Neo4j] createNode error:", err.message);
    throw err;
  } finally {
    await session.close();
  }
}

/**
 * Merge a node (upsert by unique key)
 */
export async function mergeNode(label, uniqueKey, properties) {
  if (!isConfigured()) return stub("mergeNode")(label, uniqueKey, properties);
  if (!driver) {
    await connect();
    if (!driver) return null;
  }
  const session = driver.session({ database: NEO4J_DATABASE });
  try {
    const result = await session.run(
      `MERGE (n:${label} { ${uniqueKey}: $keyValue })
       ON CREATE SET n = $props
       ON MATCH SET n += $props
       RETURN n, id(n) AS _id`,
      { keyValue: properties[uniqueKey], props: properties }
    );
    const record = result.records[0];
    if (!record) return null;
    return { id: record.get("_id"), properties: record.get("n").properties };
  } catch (err) {
    console.error("[Neo4j] mergeNode error:", err.message);
    throw err;
  } finally {
    await session.close();
  }
}

/**
 * Find relationships for a given node by id or property value
 */
export async function findRelations(nodeId, relType, direction = "BOTH") {
  if (!isConfigured()) return stub("findRelations")(nodeId, relType);
  if (!driver) {
    await connect();
    if (!driver) return null;
  }
  const session = driver.session({ database: NEO4J_DATABASE });
  try {
    const relClause = relType ? `[r:${relType}]` : "[r]";
    const arrow =
      direction === "OUT" ? "-]->" : direction === "IN" ? "<-]-" : "-";
    const cypher = `MATCH (n)${arrow}${relClause}${arrow.replace("-", "-")}(m)
                    WHERE id(n) = $nodeId OR n.name = $nodeId OR n.id = $nodeId
                    RETURN n, r, m, type(r) AS _rtype`;
    const result = await session.run(cypher, { nodeId });
    return result.records.map((record) => ({
      node: record.get("n").properties,
      relationship: {
        type: record.get("_rtype"),
        properties: record.get("r").properties || {},
      },
      related: record.get("m").properties,
    }));
  } catch (err) {
    console.error("[Neo4j] findRelations error:", err.message);
    throw err;
  } finally {
    await session.close();
  }
}

/**
 * Get subgraph within N hops of a node (for ontology visualization)
 */
export async function getSubgraph(nodeId, depth = 2, limit = 100) {
  if (!isConfigured()) return stub("getSubgraph")(nodeId, depth, limit);
  if (!driver) {
    await connect();
    if (!driver) return null;
  }
  const session = driver.session({ database: NEO4J_DATABASE });
  try {
    const cypher = `
      MATCH path = (n)-[*1..${Math.min(depth, 5)}]-(m)
      WHERE n.id = $nodeId OR n.name = $nodeId
      RETURN nodes(path) AS nodes, relationships(path) AS rels
      LIMIT ${Math.min(limit, 500)}
    `;
    const result = await session.run(cypher, { nodeId });
    const nodeMap = new Map();
    const edges = [];
    for (const record of result.records) {
      for (const node of record.get("nodes")) {
        const p = node.properties;
        nodeMap.set(p.id || p.name || node.identity.toString(), p);
      }
      for (const rel of record.get("rels")) {
        edges.push({
          source: rel.startNodeElementId,
          target: rel.endNodeElementId,
          type: rel.type,
          properties: rel.properties || {},
        });
      }
    }
    return { nodes: [...nodeMap.values()], edges };
  } catch (err) {
    console.error("[Neo4j] getSubgraph error:", err.message);
    throw err;
  } finally {
    await session.close();
  }
}

/**
 * Delete a node and all its relationships
 */
export async function deleteNode(nodeId) {
  if (!isConfigured()) return stub("deleteNode")(nodeId);
  if (!driver) {
    await connect();
    if (!driver) return null;
  }
  const session = driver.session({ database: NEO4J_DATABASE });
  try {
    const result = await session.run(
      `MATCH (n) WHERE n.id = $nodeId OR n.name = $nodeId DETACH DELETE n RETURN count(n) AS deleted`,
      { nodeId }
    );
    return result.records[0]?.get("deleted") || 0;
  } catch (err) {
    console.error("[Neo4j] deleteNode error:", err.message);
    throw err;
  } finally {
    await session.close();
  }
}

/**
 * Close the Neo4j driver connection
 */
export async function close() {
  if (driver) {
    await driver.close();
    driver = null;
    connected = false;
    console.log("[Neo4j] Connection closed");
  }
}

/**
 * Health check
 */
export async function healthCheck() {
  if (!isConfigured()) return { status: "disabled" };
  try {
    if (!driver) await connect();
    if (!driver) return { status: "unreachable" };
    await driver.verifyConnectivity();
    return { status: "connected", url: NEO4J_URL, database: NEO4J_DATABASE };
  } catch (err) {
    return { status: "error", error: err.message };
  }
}

export default {
  isConfigured,
  connect,
  queryGraph,
  transaction,
  createNode,
  mergeNode,
  findRelations,
  getSubgraph,
  deleteNode,
  close,
  healthCheck,
};