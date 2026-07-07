/**
 * Embeddings Service (Phase 3 — AI Substrate)
 *
 * Unified embedding generation across multiple providers:
 *   - OpenAI (text-embedding-3-small / 3-large)
 *   - Deterministic hash-based fallback (always available)
 *
 * The fallback lets the platform run end-to-end without external
 * LLM API keys — vector search / RAG / clustering all keep working.
 *
 * Usage:
 *   import { embed, embedBatch, cosineSimilarity } from "./ai/embeddings.js";
 *   const v = await embed("knowledge base");
 */

const LLM_BASE_URL = process.env.LLM_BASE_URL || "https://api.openai.com/v1";
const LLM_API_KEY = process.env.LLM_API_KEY || "";
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "text-embedding-3-small";
const EMBEDDING_DIM = parseInt(process.env.EMBEDDING_DIM || "384", 10);
const OPENAI_DIM_3_SMALL = 1536;
const OPENAI_DIM_3_LARGE = 3072;

let openaiLib = null;
let openaiClient = null;
let provider = "fallback";

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

/**
 * Deterministic embedding: hash seed into a fixed-dim Float32 vector, L2-normalize.
 * Same text -> same vector. Good enough for demos and CI without API keys.
 */
function deterministicVector(text, dim) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  }
  const v = new Array(dim);
  let state = h;
  for (let i = 0; i < dim; i++) {
    state = (state * 1103515245 + 12345) | 0;
    v[i] = ((state >>> 0) / 0xffffffff) * 2 - 1;
  }
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return v.map((x) => (norm === 0 ? 0 : x / norm));
}

/**
 * Resolve which backend to use. Lazily creates OpenAI client when API key set.
 */
async function getBackend() {
  if (!LLM_API_KEY) {
    return { name: "fallback", embed: (t) => deterministicVector(t, EMBEDDING_DIM) };
  }
  if (openaiClient) return { name: "openai", client: openaiClient };

  if (!openaiLib) {
    try {
      openaiLib = await import("openai");
    } catch (e) {
      console.warn("[Embeddings] openai package not installed, using fallback");
      return { name: "fallback", embed: (t) => deterministicVector(t, EMBEDDING_DIM) };
    }
  }
  openaiClient = new openaiLib.default({ apiKey: LLM_API_KEY, baseURL: LLM_BASE_URL });
  provider = "openai";
  return { name: "openai", client: openaiClient };
}

/**
 * Embed a single text. Returns Float32-array-like number[].
 */
export async function embed(text, options = {}) {
  if (!text || typeof text !== "string") {
    return new Array(EMBEDDING_DIM).fill(0);
  }
  const backend = await getBackend();
  if (backend.name === "fallback") {
    return deterministicVector(text, options.dim || EMBEDDING_DIM);
  }

  try {
    const resp = await backend.client.embeddings.create({
      model: options.model || EMBEDDING_MODEL,
      input: text.slice(0, 8000),
    });
    const vec = resp.data[0]?.embedding;
    if (!vec) throw new Error("Empty embedding response");
    return vec;
  } catch (err) {
    console.warn(`[Embeddings] OpenAI call failed (${err.message}) — falling back`);
    return deterministicVector(text, options.dim || EMBEDDING_DIM);
  }
}

/**
 * Embed a batch of texts. Returns Array<number[]>.
 * For OpenAI, chunks into batches of 100 per API call.
 */
export async function embedBatch(texts, options = {}) {
  if (!Array.isArray(texts) || texts.length === 0) return [];
  const backend = await getBackend();
  if (backend.name === "fallback") {
    return texts.map((t) => deterministicVector(String(t || ""), options.dim || EMBEDDING_DIM));
  }

  const out = [];
  const CHUNK = 100;
  for (let i = 0; i < texts.length; i += CHUNK) {
    const slice = texts.slice(i, i + CHUNK).map((t) => String(t || "").slice(0, 8000));
    try {
      const resp = await backend.client.embeddings.create({
        model: options.model || EMBEDDING_MODEL,
        input: slice,
      });
      for (const d of resp.data) out.push(d.embedding);
    } catch (err) {
      console.warn(`[Embeddings] batch failed at ${i}: ${err.message} — fallback`);
      for (const t of slice) out.push(deterministicVector(t, options.dim || EMBEDDING_DIM));
    }
  }
  return out;
}

/**
 * Find top-K nearest neighbors by cosine similarity.
 * Inputs are already-embedded vectors.
 */
export function topKSimilar(queryVec, candidates, k = 5) {
  const scored = candidates.map((c) => ({
    ...c,
    score: cosineSimilarity(queryVec, c.vector),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

/**
 * Returns current backend info for diagnostics.
 */
export function getStatus() {
  return {
    provider,
    dimension: EMBEDDING_DIM,
    model: provider === "openai" ? EMBEDDING_MODEL : "deterministic-hash",
    apiKeyConfigured: Boolean(LLM_API_KEY),
    baseUrl: LLM_BASE_URL,
    note:
      provider === "fallback"
        ? "No LLM_API_KEY — using deterministic fallback (production-quality RAG requires setting LLM_API_KEY)"
        : null,
  };
}

export { cosineSimilarity, deterministicVector };

export default {
  embed,
  embedBatch,
  topKSimilar,
  cosineSimilarity,
  deterministicVector,
  getStatus,
};