/**
 * Agent Orchestrator (Phase 3 — AI Substrate)
 *
 * Implements a tool-using agent loop:
 *   1. THINK — call LLM with available tool definitions
 *   2. ACT   — execute the chosen tool, capture the observation
 *   3. OBSERVE — feed the observation back into the conversation
 *   4. Repeat until LLM emits a final answer OR max steps reached
 *
 * Tools can be in-process functions (sync or async) returning JSON-serializable data.
 *
 * This is a simplified LangGraph-style state machine: messages + scratchpad, one
 * step per LLM call, deterministic termination when no tool call is made.
 */

import { chat } from "./llm-gateway.js";

/**
 * Built-in tool library (the platform's domain tools).
 * The orchestrator picks a subset per agent based on its `tools` list.
 */
const BUILTIN_TOOLS = {
  search_knowledge: {
    description: "Search the knowledge base using a query string. Returns top matching documents.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query (Chinese or English)" },
        topK: { type: "number", description: "Number of results to return", default: 5 },
      },
      required: ["query"],
    },
    handler: async ({ query, topK = 5 }) => {
      const { default: db } = await import("../db.js");
      const rows = db.prepare("SELECT id, title, content FROM knowledge_documents WHERE title LIKE ? OR content LIKE ? LIMIT ?").all(`%${query}%`, `%${query}%`, topK);
      return { query, hits: rows };
    },
  },
  get_ontology_object: {
    description: "Retrieve an ontology object (entity) by its id or name.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "Object id" },
      },
      required: ["id"],
    },
    handler: async ({ id }) => {
      const { default: db } = await import("../db.js");
      const row = db.prepare("SELECT * FROM ontology_objects WHERE id = ? OR name = ? LIMIT 1").get(id, id);
      return row || { error: "not_found" };
    },
  },
  query_graph: {
    description: "Execute a read-only Cypher query against the Neo4j knowledge graph.",
    parameters: {
      type: "object",
      properties: {
        cypher: { type: "string" },
        params: { type: "object" },
      },
      required: ["cypher"],
    },
    handler: async ({ cypher, params = {} }) => {
      const { neo4j } = await import("../integrations/index.js");
      const rows = await neo4j.queryGraph(cypher, params);
      return { rows: rows || [] };
    },
  },
  get_process_status: {
    description: "Look up the status of a process instance by id.",
    parameters: {
      type: "object",
      properties: { instanceId: { type: "string" } },
      required: ["instanceId"],
    },
    handler: async ({ instanceId }) => {
      const { default: db } = await import("../db.js");
      const row = db.prepare("SELECT id, status, definition_id, started_at, ended_at FROM process_instances WHERE id = ?").get(instanceId);
      return row || { error: "not_found" };
    },
  },
  emit_event: {
    description: "Publish an event to the Kafka event bus.",
    parameters: {
      type: "object",
      properties: {
        topic: { type: "string" },
        value: { type: "object" },
      },
      required: ["topic", "value"],
    },
    handler: async ({ topic, value }) => {
      const { kafka } = await import("../integrations/index.js");
      return kafka.publish(topic, { value });
    },
  },
};

/**
 * Convert a tool definition to the JSON Schema fragment that goes into
 * the LLM system prompt's "available tools" section.
 */
function describeTools(toolNames) {
  const lines = [];
  for (const name of toolNames) {
    const t = BUILTIN_TOOLS[name];
    if (!t) continue;
    lines.push(`- ${name}: ${t.description}`);
    lines.push(`  parameters: ${JSON.stringify(t.parameters)}`);
  }
  return lines.join("\n");
}

/**
 * Parse the LLM response to extract a tool call.
 * Supports two formats:
 *   1) JSON tool call wrapped in ```json ... ``` fences
 *   2) Plain JSON object with { tool, args } keys
 */
function parseToolCall(text) {
  if (!text) return null;

  // Try fenced JSON first
  const fencedMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (fencedMatch) {
    try {
      const parsed = JSON.parse(fencedMatch[1]);
      if (parsed.tool && parsed.args) return parsed;
    } catch {}
  }

  // Try bare JSON object containing tool/args
  const jsonMatch = text.match(/\{[\s\S]*?"tool"\s*:\s*"[a-z_]+"[\s\S]*?\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.tool && parsed.args) return parsed;
    } catch {}
  }

  return null;
}

/**
 * Run an agent loop until completion or max steps.
 *
 * @param {object} opts
 * @param {string} opts.question       - The user's question
 * @param {string[]} opts.tools        - List of tool names to enable
 * @param {string} [opts.systemPrompt] - Override system prompt
 * @param {number} [opts.maxSteps=5]   - Max tool-call iterations
 * @param {string} [opts.model]        - Override LLM model
 * @returns {Promise<{ answer: string, steps: object[], totalTokens: number }>}
 */
export async function runAgent({
  question,
  tools = ["search_knowledge", "get_ontology_object", "query_graph", "get_process_status"],
  systemPrompt,
  maxSteps = 5,
  model,
}) {
  const defaultSystem = `You are MetaPlatform Agent, an expert AI assistant for the enterprise AI middleware platform.
You can use the following tools to answer the user's question.
When you need to call a tool, respond with a JSON object fenced in \`\`\`json:
\`\`\`json
{ "tool": "<tool_name>", "args": { ... } }
\`\`\`
Otherwise respond with a concise final answer in natural language.

Available tools:
${describeTools(tools)}`;

  const messages = [{ role: "user", content: question }];
  const steps = [];
  let totalTokens = 0;
  let finalAnswer = null;

  for (let step = 0; step < maxSteps; step++) {
    const { content, usage, provider } = await chat({
      messages,
      systemPrompt: systemPrompt || defaultSystem,
      model,
      temperature: 0.3,
    });
    totalTokens += (usage?.prompt_tokens || 0) + (usage?.completion_tokens || 0);

    const toolCall = parseToolCall(content);

    if (!toolCall) {
      finalAnswer = content;
      steps.push({ step, role: "final", content, provider });
      break;
    }

    const toolDef = BUILTIN_TOOLS[toolCall.tool];
    let observation;
    if (!toolDef) {
      observation = { error: `unknown_tool: ${toolCall.tool}` };
    } else {
      try {
        observation = await toolDef.handler(toolCall.args || {});
      } catch (err) {
        observation = { error: err.message };
      }
    }

    steps.push({
      step,
      role: "tool_call",
      tool: toolCall.tool,
      args: toolCall.args,
      observation,
      raw: content,
    });

    // Feed observation back so the LLM can synthesize the next step.
    messages.push({ role: "assistant", content });
    messages.push({
      role: "user",
      content: `Tool ${toolCall.tool} returned: ${JSON.stringify(observation).slice(0, 4000)}`,
    });
  }

  if (!finalAnswer) {
    finalAnswer = "Agent reached maximum steps without producing a final answer.";
  }

  return {
    answer: finalAnswer,
    steps,
    stepsTaken: steps.length,
    totalTokens,
  };
}

/**
 * List available tools (for the agent editor UI).
 */
export function listTools() {
  return Object.entries(BUILTIN_TOOLS).map(([name, t]) => ({
    name,
    description: t.description,
    parameters: t.parameters,
  }));
}

export default { runAgent, listTools };