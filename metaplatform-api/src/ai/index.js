/**
 * AI Substrate — Barrel file (Phase 3)
 *
 * Re-exports all AI substrate modules and provides aggregate health/status.
 */
import * as embeddings from "./embeddings.js";
import * as llmGateway from "./llm-gateway.js";
import * as agent from "./agent.js";
import * as ocr from "./ocr.js";
import * as rag from "./rag.js";

export { embeddings, llmGateway, agent, ocr, rag };

/**
 * Health/status of all AI components.
 */
export function getStatus() {
  return {
    embeddings: embeddings.getStatus(),
    llm: llmGateway.getStatus(),
    ocr: ocr.getStatus(),
    agent: {
      toolsAvailable: agent.listTools().length,
      toolNames: agent.listTools().map((t) => t.name),
    },
    rag: {
      collection: process.env.RAG_COLLECTION || "metaplatform_vectors",
      topK: parseInt(process.env.RAG_TOPK || "5", 10),
      maxContextChars: parseInt(process.env.RAG_MAX_CONTEXT_CHARS || "8000", 10),
    },
    timestamp: new Date().toISOString(),
  };
}

export default {
  embeddings,
  llmGateway,
  agent,
  ocr,
  rag,
  getStatus,
};