/**
 * OCR Service (Phase 3 — AI Substrate)
 *
 * Real OCR via tesseract.js (no native deps, runs entirely in Node.js).
 * Supports Chinese + English by default (eng+chi_sim traineddata).
 *
 * First call downloads language models (~30MB) and caches them locally
 * under node_modules/tesseract.js-core and tesseract.js worker cache.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_LANGS = (process.env.OCR_LANGS || "eng+chi_sim").split("+");
const CACHE_DIR = process.env.OCR_CACHE_DIR || path.join(__dirname, "..", "..", ".ocr-cache");

let tesseractLib = null;
let worker = null;
let workerLangs = null;

async function loadTesseract() {
  if (tesseractLib) return tesseractLib;
  try {
    const mod = await import("tesseract.js");
    tesseractLib = mod;
    return mod;
  } catch (err) {
    throw new Error("tesseract.js not installed");
  }
}

async function getWorker(langs = DEFAULT_LANGS) {
  await loadTesseract();
  const langKey = Array.isArray(langs) ? langs.sort().join("+") : String(langs);
  if (worker && workerLangs === langKey) return worker;

  // Dispose old worker
  if (worker) {
    try {
      await worker.terminate();
    } catch {}
    worker = null;
  }

  worker = await tesseractLib.createWorker(langKey, 1, {
    cachePath: CACHE_DIR,
    logger: () => {}, // suppress progress logs
  });
  workerLangs = langKey;
  return worker;
}

/**
 * Run OCR on a Buffer / Uint8Array / base64 string.
 * @param {Buffer|string} input - Image bytes or base64 data URI
 * @param {object} [opts]
 * @param {string} [opts.langs]   - Language codes (e.g. "eng", "chi_sim", "eng+chi_sim")
 * @returns {Promise<{text: string, confidence: number, blocks: any[]}>}
 */
export async function recognize(input, opts = {}) {
  const langs = (opts.langs || DEFAULT_LANGS.join("+")).split("+");
  const w = await getWorker(langs);
  const buffer = Buffer.isBuffer(input)
    ? input
    : typeof input === "string"
      ? Buffer.from(input.replace(/^data:[^;]+;base64,/, ""), "base64")
      : Buffer.from(input);

  const { data } = await w.recognize(buffer);

  return {
    text: data.text?.trim() || "",
    confidence: data.confidence || 0,
    language: langs.join("+"),
    blocks: (data.blocks || []).map((b) => ({
      confidence: b.confidence,
      text: b.text,
      lines: (b.lines || []).map((l) => ({ confidence: l.confidence, text: l.text })),
    })),
    raw: data,
  };
}

/**
 * Detect the language of a text snippet using simple heuristics.
 * Lightweight fallback; not a real LID model.
 */
export function detectLanguage(text) {
  if (!text) return "unknown";
  let cjk = 0, latin = 0, digit = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0);
    if (code >= 0x4e00 && code <= 0x9fff) cjk++;
    else if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) latin++;
    else if (code >= 48 && code <= 57) digit++;
  }
  const total = cjk + latin + digit;
  if (total === 0) return "unknown";
  if (cjk / total > 0.3) return "zh";
  if (latin / total > 0.5) return "en";
  return "mixed";
}

/**
 * Tear down the OCR worker (call on graceful shutdown).
 */
export async function shutdown() {
  if (worker) {
    try {
      await worker.terminate();
    } catch {}
    worker = null;
    workerLangs = null;
  }
}

export function getStatus() {
  return {
    available: Boolean(tesseractLib || true),
    defaultLangs: DEFAULT_LANGS,
    cacheDir: CACHE_DIR,
    activeLangs: workerLangs,
    note: "First OCR call downloads language models (~30MB). Subsequent calls are fast.",
  };
}

export default { recognize, detectLanguage, shutdown, getStatus };