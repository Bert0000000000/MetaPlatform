/**
 * RAG (Retrieval-Augmented Generation) Service (Phase 3)
 *
 * End-to-end question answering pipeline:
 *   1. Embed the user's question (embeddings.js)
 *   2. Retrieve top-K chunks from vector store (Milvus memory fallback)
 *   3. Re-rank by hybrid score (vector + keyword)
 *   4. Assemble a context window
 *   5. Send to LLM gateway with the context
 *   6. Stream / return the synthesized answer + citations
 */

import { embed, topKSimilar } from "./embeddings.js";
import { chat } from "./llm-gateway.js";
import { milvus, elasticsearch } from "../integrations/index.js";

const DEFAULT_TOPK = parseInt(process.env.RAG_TOPK || "5", 10);
const DEFAULT_COLLECTION = process.env.RAG_COLLECTION || "metaplatform_vectors";
const MAX_CONTEXT_CHARS = parseInt(process.env.RAG_MAX_CONTEXT_CHARS || "8000", 10);

/**
 * Index knowledge documents into the vector store.
 * @param {Array<{id:string, title:string, content:string}>} docs
 */
export async function indexDocuments(docs, collection = DEFAULT_COLLECTION) {
  if (!Array.isArray(docs) || docs.length === 0) return { indexed: 0 };
  await milvus.createCollection(collection, parseInt(process.env.EMBEDDING_DIM || "384", 10));

  const vectors = await Promise.all(
    docs.map(async (d) => ({
      id: d.id,
      vector: await embed(`${d.title || ""}\n${d.content || ""}`.trim()),
      content: `${d.title || ""}\n${d.content || ""}`.slice(0, 4000),
      metadata: { id: d.id, title: d.title, type: d.type || "document" },
    }))
  );

  return milvus.insertVectors(collection, vectors);
}

/**
 * Hybrid retrieval: combine vector similarity (Milvus) and keyword (Elasticsearch).
 * Returns a single ranked list.
 */
export async function retrieve(query, opts = {}) {
  const topK = opts.topK || DEFAULT_TOPK;
  const collection = opts.collection || DEFAULT_COLLECTION;

  // Vector side
  const queryVec = await embed(query);
  const vectorHits = await milvus.search(collection, queryVec, { topK: topK * 2 });
  const vectorScored = (vectorHits || []).map((h) => ({
    id: h.id,
    content: h.content,
    metadata: h.metadata || {},
    vectorScore: h.score || 0,
    source: "vector",
  }));

  // Keyword side
  let keywordScored = [];
  try {
    if (elasticsearch.isConfigured()) {
      const res = await elasticsearch.searchText(query, { size: topK * 2 });
      keywordScored = (res.hits || []).map((h) => ({
        id: h.id,
        content: `${h.source?.title || ""}\n${h.source?.content || ""}`.trim(),
        metadata: h.source || {},
        keywordScore: h.score || 0,
        source: "keyword",
      }));
    }
  } catch (err) {
    // ES not available — keyword side returns []
  }

  // Merge by id (take the better of the two scores per id)
  const merged = new Map();
  for (const v of vectorScored) {
    merged.set(v.id, { ...v, hybridScore: (v.vectorScore + 1) / 2 });
  }
  for (const k of keywordScored) {
    const existing = merged.get(k.id);
    if (existing) {
      existing.hybridScore = (existing.hybridScore + (k.keywordScore || 0)) / 2 + 0.05; // tie-breaker
      existing.source = "hybrid";
    } else {
      merged.set(k.id, {
        ...k,
        hybridScore: (k.keywordScore || 0) * 0.5 + 0.05,
      });
    }
  }

  return [...merged.values()].sort((a, b) => b.hybridScore - a.hybridScore).slice(0, topK);
}

/**
 * Assemble a context block from retrieved chunks.
 */
function buildContext(chunks) {
  const parts = [];
  let total = 0;
  for (const c of chunks) {
    const snippet = (c.content || "").slice(0, 1000);
    const block = `[Source ${c.id}]\n${snippet}\n`;
    if (total + block.length > MAX_CONTEXT_CHARS) break;
    parts.push(block);
    total += block.length;
  }
  return parts.join("\n---\n");
}

/**
 * Run RAG: retrieve + LLM answer with citations.
 *
 * @param {object} opts
 * @param {string} opts.question   - The user's question
 * @param {Array} [opts.history]   - Prior chat history [{role, content}]
 * @param {number} [opts.topK]
 * @param {string} [opts.collection]
 * @returns {Promise<{answer, citations, retrieved, usage}>}
 */
export async function answer({ question, history = [], topK = DEFAULT_TOPK, collection = DEFAULT_COLLECTION, systemPrompt }) {
  const retrieved = await retrieve(question, { topK, collection });
  const context = buildContext(retrieved);
  const defaultSystem = `You are MetaPlatform Knowledge Assistant.
Answer the user's question using ONLY the context below. If the context does not contain
the answer, say "I don't know based on the available documents." Cite each source by id.

Context:
${context || "(no documents retrieved)"}`;

  const messages = [
    ...history.slice(-6),
    { role: "user", content: question },
  ];

  const { content, usage, provider, model } = await chat({
    messages,
    systemPrompt: systemPrompt || defaultSystem,
    temperature: 0.2,
    maxTokens: 600,
  });

  return {
    answer: content,
    citations: retrieved.map((r) => ({
      id: r.id,
      title: r.metadata?.title || r.id,
      score: Number((r.hybridScore || 0).toFixed(4)),
      source: r.source,
    })),
    retrieved: retrieved.length,
    usage,
    provider,
    model,
  };
}

export default { indexDocuments, retrieve, answer };