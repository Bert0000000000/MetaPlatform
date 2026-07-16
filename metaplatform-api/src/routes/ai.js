/**
 * /api/ai — Unified AI substrate endpoints (Phase 3)
 *
 *   GET    /api/ai/status                 — backend health & config
 *   POST   /api/ai/embed                  — embed a single text
 *   POST   /api/ai/embed/batch            — embed multiple texts
 *   POST   /api/ai/chat                   — chat completion (non-streaming)
 *   POST   /api/ai/chat/stream            — chat completion (SSE streaming)
 *   POST   /api/ai/agent                  — run tool-using agent loop
 *   GET    /api/ai/agent/tools            — list available agent tools
 *   POST   /api/ai/rag/answer             — RAG: retrieve + answer with citations
 *   POST   /api/ai/rag/index              — index knowledge documents into vector store
 *   POST   /api/ai/rag/retrieve           — retrieve only (no LLM)
 *   POST   /api/ai/ocr                    — OCR an image (multipart upload)
 *   POST   /api/ai/ocr/detect             — language detection on text
 */
import { Router } from "express";
import multer from "multer";
import {
  embeddings,
  llmGateway,
  agent,
  ocr,
  rag,
  getStatus as aiStatus,
} from "../ai/index.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// ─── Status ──────────────────────────────────────────────
router.get("/status", (_req, res) => {
  res.json({ success: true, data: aiStatus() });
});

// ─── Embeddings ──────────────────────────────────────────
router.post("/embed", async (req, res, next) => {
  try {
    const { text, model, dim } = req.body;
    if (typeof text !== "string") return res.status(400).json({ success: false, error: "text 为必填项" });
    const vec = await embeddings.embed(text, { model, dim });
    res.json({ success: true, data: { dimension: vec.length, vector: vec } });
  } catch (err) { next(err); }
});

router.post("/embed/batch", async (req, res, next) => {
  try {
    const { texts, model, dim } = req.body;
    if (!Array.isArray(texts)) return res.status(400).json({ success: false, error: "texts 必须为数组" });
    const vectors = await embeddings.embedBatch(texts, { model, dim });
    res.json({ success: true, data: { count: vectors.length, vectors } });
  } catch (err) { next(err); }
});

// ─── LLM Chat ────────────────────────────────────────────
router.post("/chat", async (req, res, next) => {
  try {
    const { messages, model, temperature, maxTokens, systemPrompt } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ success: false, error: "messages 数组为必填项" });
    }
    const result = await llmGateway.chat({ messages, model, temperature, maxTokens, systemPrompt });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

router.post("/chat/stream", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  try {
    const { messages, model, temperature, maxTokens, systemPrompt } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      res.write(`data: ${JSON.stringify({ error: "messages 数组为必填项" })}\n\n`);
      res.end();
      return;
    }
    for await (const chunk of llmGateway.streamChat({ messages, model, temperature, maxTokens, systemPrompt })) {
      res.write(`data: ${JSON.stringify({ delta: chunk })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// ─── Agent ───────────────────────────────────────────────
router.post("/agent", async (req, res, next) => {
  try {
    const { question, tools, systemPrompt, maxSteps, model } = req.body;
    if (typeof question !== "string" || !question.trim()) {
      return res.status(400).json({ success: false, error: "question 为必填项" });
    }
    const result = await agent.runAgent({ question, tools, systemPrompt, maxSteps, model });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

router.get("/agent/tools", (_req, res) => {
  res.json({ success: true, data: agent.listTools() });
});

// ─── RAG ─────────────────────────────────────────────────
router.post("/rag/index", async (req, res, next) => {
  try {
    const { documents, collection } = req.body;
    if (!Array.isArray(documents)) return res.status(400).json({ success: false, error: "documents 必须为数组" });
    const result = await rag.indexDocuments(documents, collection);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
});

router.post("/rag/retrieve", async (req, res, next) => {
  try {
    const { query, topK, collection } = req.body;
    if (typeof query !== "string") return res.status(400).json({ success: false, error: "query 为必填项" });
    const chunks = await rag.retrieve(query, { topK, collection });
    res.json({ success: true, data: { query, count: chunks.length, chunks } });
  } catch (err) { next(err); }
});

router.post("/rag/answer", async (req, res, next) => {
  try {
    const { question, history, topK, collection, systemPrompt } = req.body;
    if (typeof question !== "string") return res.status(400).json({ success: false, error: "question 为必填项" });
    const result = await rag.answer({ question, history, topK, collection, systemPrompt });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// ─── OCR ─────────────────────────────────────────────────
router.post("/ocr", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: "file 为必填项" });
    const langs = req.body.langs || undefined;
    const result = await ocr.recognize(req.file.buffer, { langs });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

router.post("/ocr/detect", (req, res) => {
  const { text } = req.body;
  if (typeof text !== "string") return res.status(400).json({ success: false, error: "text 为必填项" });
  res.json({ success: true, data: { language: ocr.detectLanguage(text) } });
});

export default router;