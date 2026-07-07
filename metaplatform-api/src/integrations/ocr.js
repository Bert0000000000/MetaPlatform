/**
 * OCR (Optical Character Recognition) Integration (ESM, stub)
 *
 * Phase 3: AI substrate enhancement — PaddleOCR/Tesseract.
 * Stub implementation — real OCR engine integration comes in Phase 3.
 */

export async function recognizeText(_imageBuffer, _options = {}) {
  // Phase 2 stub. Phase 3 will replace with PaddleOCR server or Tesseract.
  return {
    stub: true,
    text: "",
    confidence: 0,
    blocks: [],
    note: "OCR engine not yet wired — Phase 3 deliverable",
  };
}

export default { recognizeText };