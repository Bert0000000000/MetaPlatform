/**
 * Process Simulation Module
 *
 * Provides BPMN process simulation engine with Monte Carlo simulation logic.
 * Simulates process execution with variable inputs, branching decisions, and
 * statistical analysis of execution times and outcomes.
 *
 * @module integrations/simulation
 */

const { v4: uuidv4 } = require('uuid');

/** In-memory simulation results store */
const simulationResults = new Map();

/**
 * Generate a random duration from a distribution
 * Uses a log-normal distribution to model realistic task durations
 * @param {number} meanHours - Mean duration in hours
 * @param {number} stdDevHours - Standard deviation in hours
 * @returns {number} Simulated duration in hours
 */
function generateLogNormalDuration(meanHours, stdDevHours) {
  // Box-Muller transform for normal distribution
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

  // Log-normal parameters
  const mu = Math.log(meanHours);
  const sigma = stdDevHours / meanHours;

  return Math.max(0.01, Math.exp(mu + sigma * z));
}

/**
 * Evaluate a gateway condition expression
 * @param {string} expression - Condition expression (e.g., "amount > 50000")
 * @param {object} variables - Process variables
 * @returns {boolean}
 */
function evaluateCondition(expression, variables) {
  if (!expression) return true;

  try {
    // Simple expression evaluator: supports ==, !=, >, <, >=, <=, &&, ||
    let expr = expression;

    // Replace variable names with their values
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\b${key}\\b`, 'g');
      expr = expr.replace(regex, typeof value === 'string' ? `"${value}"` : String(value));
    }

    // Basic safety check - only allow simple comparisons
    if (/[^0-9a-zA-Z"'.=!<>&|+\-*/()\s]/.test(expr.replace(/"[^"]*"/g, ''))) {
      console.warn(`[Simulation] Unsafe expression rejected: ${expression}`);
      return true; // Default to true for unrecognized expressions
    }

    // Use Function constructor for safe evaluation (no access to outer scope)
    const fn = new Function(`"use strict"; return (${expr});`);
    return Boolean(fn());
  } catch (err) {
    console.warn(`[Simulation] Could not evaluate condition '${expression}': ${err.message}`);
    return true; // Default to true if evaluation fails
  }
}

/**
 * Run a single simulation instance
 * @param {object} processDef - Process definition
 * @param {object} variables - Process variables
 * @returns {object} Simulation instance result
 */
function runSingleInstance(processDef, variables) {
  const nodes = processDef.nodes || [];
  const edges = processDef.edges || [];
  const instanceId = uuidv4().slice(0, 8);
  const visited = [];
  let totalDuration = 0;
  let currentNodeId = nodes.find((n) => n.type === 'start')?.id || nodes[0]?.id;

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const edgeMap = new Map();
  for (const edge of edges) {
    if (!edgeMap.has(edge.source)) edgeMap.set(edge.source, []);
    edgeMap.get(edge.source).push(edge);
  }

  let maxSteps = 100; // Safety limit
  while (currentNodeId && maxSteps > 0) {
    maxSteps--;
    const node = nodeMap.get(currentNodeId);
    if (!node) break;

    // Calculate node duration
    let nodeDuration = 0;
    if (node.type === 'task' || node.type === 'userTask' || node.type === 'serviceTask') {
      const meanHours = node.meanDuration || 2;
      const stdDev = node.stdDevDuration || meanHours * 0.3;
      nodeDuration = generateLogNormalDuration(meanHours, stdDev);
    }

    visited.push({
      nodeId: currentNodeId,
      nodeName: node.name || node.label || currentNodeId,
      nodeType: node.type || 'task',
      duration: Math.round(nodeDuration * 100) / 100,
      timestamp: totalDuration,
    });

    totalDuration += nodeDuration;

    // End node
    if (node.type === 'end' || node.type === 'endEvent') {
      break;
    }

    // Find next edge(s)
    const outEdges = edgeMap.get(currentNodeId) || [];
    if (outEdges.length === 0) break;

    if (outEdges.length === 1) {
      // Simple transition
      currentNodeId = outEdges[0].target;
    } else {
      // Gateway: evaluate conditions
      let selectedEdge = null;
      for (const edge of outEdges) {
        const condition = edge.condition || edge.label || '';
        if (evaluateCondition(condition, variables)) {
          selectedEdge = edge;
          break;
        }
      }
      currentNodeId = selectedEdge ? selectedEdge.target : outEdges[0].target;
    }
  }

  return {
    instanceId,
    path: visited,
    totalDuration: Math.round(totalDuration * 100) / 100,
    completed: visited.length > 0 && visited[visited.length - 1].nodeType === 'end',
    stepCount: visited.length,
  };
}

/**
 * Simulate a BPMN process with Monte Carlo method
 *
 * Runs the process definition multiple times with variable randomization
 * to produce statistical analysis of execution outcomes.
 *
 * @param {object} processDefinition - The BPMN process definition
 * @param {object} [variables={}] - Process variables (e.g., { amount: 60000, applicant: "Wang" })
 * @param {object} [options] - Simulation options
 * @param {number} [options.iterations=100] - Number of Monte Carlo iterations
 * @returns {Promise<object|null>} Simulation results or null
 */
async function simulateProcess(processDefinition, variables = {}, options = {}) {
  const iterations = options.iterations || 100;
  const simId = uuidv4().slice(0, 8);

  console.log(`[Simulation] Starting simulation '${simId}' with ${iterations} iterations`);

  const results = [];
  for (let i = 0; i < iterations; i++) {
    // Add random variation to variables for each iteration
    const variedVars = { ...variables };
    for (const [key, value] of Object.entries(variedVars)) {
      if (typeof value === 'number') {
        // Add +/- 10% noise to numeric variables
        const noise = 1 + (Math.random() - 0.5) * 0.2;
        variedVars[key] = Math.round(value * noise * 100) / 100;
      }
    }

    results.push(runSingleInstance(processDefinition, variedVars));
  }

  // Statistical analysis
  const durations = results.map((r) => r.totalDuration);
  const completedResults = results.filter((r) => r.completed);
  const completionRate = (completedResults.length / results.length) * 100;

  durations.sort((a, b) => a - b);
  const mean = durations.reduce((s, d) => s + d, 0) / durations.length;
  const median = durations[Math.floor(durations.length / 2)];
  const p95 = durations[Math.floor(durations.length * 0.95)];
  const min = durations[0];
  const max = durations[durations.length - 1];
  const stdDev = Math.sqrt(
    durations.reduce((s, d) => s + (d - mean) ** 2, 0) / durations.length
  );

  // Path frequency analysis
  const pathFrequency = {};
  for (const r of results) {
    const pathKey = r.path.map((p) => p.nodeId).join(' -> ');
    pathFrequency[pathKey] = (pathFrequency[pathKey] || 0) + 1;
  }

  const topPaths = Object.entries(pathFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([path, count]) => ({
      path,
      count,
      percentage: Math.round((count / results.length) * 100 * 10) / 10,
    }));

  // Bottleneck analysis
  const nodeDurations = {};
  for (const r of results) {
    for (const step of r.path) {
      if (!nodeDurations[step.nodeId]) nodeDurations[step.nodeId] = [];
      nodeDurations[step.nodeId].push(step.duration);
    }
  }

  const bottlenecks = Object.entries(nodeDurations)
    .map(([nodeId, durs]) => ({
      nodeId,
      nodeName: results[0]?.path.find((p) => p.nodeId === nodeId)?.nodeName || nodeId,
      avgDuration: Math.round((durs.reduce((s, d) => s + d, 0) / durs.length) * 100) / 100,
      maxDuration: Math.round(Math.max(...durs) * 100) / 100,
      occurrences: durs.length,
      occurrenceRate: Math.round((durs.length / results.length) * 100 * 10) / 10,
    }))
    .sort((a, b) => b.avgDuration - a.avgDuration);

  const simResult = {
    simulationId: simId,
    iterations,
    variables,
    statistics: {
      meanDuration: Math.round(mean * 100) / 100,
      medianDuration: Math.round(median * 100) / 100,
      p95Duration: Math.round(p95 * 100) / 100,
      minDuration: Math.round(min * 100) / 100,
      maxDuration: Math.round(max * 100) / 100,
      stdDeviation: Math.round(stdDev * 100) / 100,
      completionRate: Math.round(completionRate * 10) / 10,
    },
    topPaths,
    bottlenecks: bottlenecks.slice(0, 5),
    sampleRuns: results.slice(0, 3),
    createdAt: new Date().toISOString(),
  };

  // Store result
  simulationResults.set(simId, simResult);

  console.log(`[Simulation] Simulation '${simId}' completed: mean=${simResult.statistics.meanDuration}h, completion=${completionRate}%`);
  return simResult;
}

/**
 * Get a previously computed simulation result
 *
 * @param {string} instanceId - The simulation instance ID
 * @returns {Promise<object|null>} The simulation result or null
 */
async function getSimulationResult(instanceId) {
  const result = simulationResults.get(instanceId);
  if (!result) {
    console.warn(`[Simulation] Result not found for instance '${instanceId}'`);
    return null;
  }
  return result;
}

module.exports = { simulateProcess, getSimulationResult };
