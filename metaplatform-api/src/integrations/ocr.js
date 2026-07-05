/**
 * OCR Integration Module
 *
 * Provides text recognition, invoice recognition, and ID card recognition
 * using cloud OCR APIs or Tesseract. When no OCR service is configured,
 * exports stub methods that log and return null.
 *
 * @module integrations/ocr
 */

const OCR_API_URL = process.env.OCR_API_URL || '';
const OCR_API_KEY = process.env.OCR_API_KEY || '';

/**
 * Check if OCR service is configured via environment variables
 * @returns {boolean}
 */
function isConfigured() {
  return Boolean(OCR_API_URL);
}

/**
 * Create a stub method that logs a message and returns null
 * @param {string} methodName
 * @returns {Function}
 */
function stub(methodName) {
  return (...args) => {
    console.warn(`[OCR] ${methodName}: Service not configured (OCR_API_URL is not set). Args:`, JSON.stringify(args.slice(0, 1)));
    return null;
  };
}

/**
 * Send an image buffer to the OCR API
 * @param {Buffer} imageBuffer - The image data
 * @param {string} [mode='general'] - Recognition mode
 * @returns {Promise<object>} OCR API response
 */
async function callOcrApi(imageBuffer, mode = 'general') {
  if (!isConfigured()) {
    return stub('callOcrApi')(imageBuffer, mode);
  }

  const base64Image = imageBuffer.toString('base64');

  const response = await fetch(`${OCR_API_URL}/ocr/${mode}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(OCR_API_KEY ? { Authorization: `Bearer ${OCR_API_KEY}` } : {}),
    },
    body: JSON.stringify({
      image: base64Image,
      mode,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`OCR API error: HTTP ${response.status} - ${text}`);
  }

  return response.json();
}

/**
 * Recognize and extract text from an image
 *
 * @param {Buffer} imageBuffer - The image data as a Buffer
 * @returns {Promise<{text: string, confidence: number, words: Array}|null>} Recognized text or null
 */
async function recognizeText(imageBuffer) {
  if (!isConfigured()) {
    return stub('recognizeText')(imageBuffer);
  }

  try {
    const result = await callOcrApi(imageBuffer, 'general');

    return {
      text: result.text || result.fullText || '',
      confidence: result.confidence || result.avgConfidence || 0,
      words: (result.words || result.regions || []).map((w) => ({
        text: w.text || w.word || '',
        confidence: w.confidence || 0,
        bbox: w.bbox || w.boundingBox || null,
      })),
    };
  } catch (err) {
    console.error('[OCR] recognizeText error:', err.message);
    throw err;
  }
}

/**
 * Recognize and extract structured data from an invoice image
 *
 * @param {Buffer} imageBuffer - The invoice image data as a Buffer
 * @returns {Promise<{invoiceNo: string, date: string, total: number, vendor: string, items: Array, rawText: string}|null>} Invoice data or null
 */
async function recognizeInvoice(imageBuffer) {
  if (!isConfigured()) {
    return stub('recognizeInvoice')(imageBuffer);
  }

  try {
    const result = await callOcrApi(imageBuffer, 'invoice');

    return {
      invoiceNo: result.invoiceNo || result.invoice_number || '',
      date: result.date || result.invoice_date || '',
      total: result.total || result.totalAmount || 0,
      subtotal: result.subtotal || 0,
      tax: result.tax || result.taxAmount || 0,
      vendor: result.vendor || result.seller || '',
      buyer: result.buyer || '',
      items: (result.items || result.lineItems || []).map((item) => ({
        description: item.description || item.name || '',
        quantity: item.quantity || item.qty || 0,
        unitPrice: item.unitPrice || item.price || 0,
        amount: item.amount || item.total || 0,
      })),
      rawText: result.rawText || result.text || '',
      confidence: result.confidence || 0,
    };
  } catch (err) {
    console.error('[OCR] recognizeInvoice error:', err.message);
    throw err;
  }
}

/**
 * Recognize and extract structured data from an ID card image
 *
 * @param {Buffer} imageBuffer - The ID card image data as a Buffer
 * @returns {Promise<{name: string, idNumber: string, gender: string, birthDate: string, address: string, nationality: string, validity: string}|null>} ID card data or null
 */
async function recognizeIdCard(imageBuffer) {
  if (!isConfigured()) {
    return stub('recognizeIdCard')(imageBuffer);
  }

  try {
    const result = await callOcrApi(imageBuffer, 'idcard');

    return {
      name: result.name || result.fullName || '',
      idNumber: result.idNumber || result.id_number || result.cardNumber || '',
      gender: result.gender || result.sex || '',
      birthDate: result.birthDate || result.birth || result.dateOfBirth || '',
      address: result.address || result.residentialAddress || '',
      nationality: result.nationality || result.ethnicity || '',
      validity: result.validity || result.validPeriod || '',
      issuingAuthority: result.issuingAuthority || result.issuer || '',
      side: result.side || result.cardSide || 'front',
      confidence: result.confidence || 0,
    };
  } catch (err) {
    console.error('[OCR] recognizeIdCard error:', err.message);
    throw err;
  }
}

// Export real or stub methods based on configuration
if (isConfigured()) {
  module.exports = { recognizeText, recognizeInvoice, recognizeIdCard };
} else {
  module.exports = {
    recognizeText: stub('recognizeText'),
    recognizeInvoice: stub('recognizeInvoice'),
    recognizeIdCard: stub('recognizeIdCard'),
  };
}
