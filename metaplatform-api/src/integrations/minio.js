/**
 * MinIO Object Storage Integration
 *
 * Provides file upload, download, deletion, and presigned URL generation.
 * When MINIO_ENDPOINT is not configured, exports stub methods that log and return null.
 *
 * @module integrations/minio
 */

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || '';
const MINIO_PORT = parseInt(process.env.MINIO_PORT || '9000', 10);
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || '';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || '';
const MINIO_BUCKET = process.env.MINIO_BUCKET || 'metaplatform';
const MINIO_USE_SSL = process.env.MINIO_USE_SSL === 'true';

let client = null;
let Minio = null;

/**
 * Check if MinIO is configured via environment variables
 * @returns {boolean}
 */
function isConfigured() {
  return Boolean(MINIO_ENDPOINT && MINIO_ACCESS_KEY && MINIO_SECRET_KEY);
}

/**
 * Create a stub method that logs a message and returns null
 * @param {string} methodName
 * @returns {Function}
 */
function stub(methodName) {
  return (...args) => {
    console.warn(`[MinIO] ${methodName}: Service not configured (MINIO_ENDPOINT is not set). Args:`, JSON.stringify(args.slice(0, 2)));
    return null;
  };
}

/**
 * Connect to MinIO and ensure the default bucket exists
 * @returns {Promise<object|null>} The MinIO client or null
 */
async function connect() {
  if (!isConfigured()) {
    console.warn('[MinIO] connect: Service not configured (MINIO_ENDPOINT/ACCESS_KEY/SECRET_KEY not set)');
    return null;
  }

  try {
    if (!Minio) {
      try {
        Minio = require('minio');
      } catch (e) {
        console.error('[MinIO] minio package not installed. Run: npm install minio');
        return null;
      }
    }

    client = new Minio.Client({
      endPoint: MINIO_ENDPOINT,
      port: MINIO_PORT,
      useSSL: MINIO_USE_SSL,
      accessKey: MINIO_ACCESS_KEY,
      secretKey: MINIO_SECRET_KEY,
    });

    // Verify connectivity by checking bucket existence
    const exists = await client.bucketExists(MINIO_BUCKET);
    if (!exists) {
      await client.makeBucket(MINIO_BUCKET);
      console.log(`[MinIO] Created bucket '${MINIO_BUCKET}'`);
    }

    console.log(`[MinIO] Connected to ${MINIO_ENDPOINT}:${MINIO_PORT}, bucket: ${MINIO_BUCKET}`);
    return client;
  } catch (err) {
    console.error('[MinIO] Connection failed:', err.message);
    client = null;
    return null;
  }
}

/**
 * Upload a file to MinIO
 * @param {string} objectName - The object name/key in the bucket
 * @param {Buffer|ReadableStream|string} data - The file data
 * @param {object} [meta] - Optional metadata (Content-Type, etc.)
 * @returns {Promise<object|null>} Upload result with etag or null
 */
async function uploadFile(objectName, data, meta = {}) {
  if (!isConfigured()) {
    return stub('uploadFile')(objectName, data, meta);
  }

  if (!client) {
    await connect();
    if (!client) return null;
  }

  try {
    const metaData = {
      'Content-Type': meta.contentType || 'application/octet-stream',
      ...meta,
    };

    const result = await client.putObject(
      MINIO_BUCKET,
      objectName,
      data,
      typeof data === 'string' ? undefined : undefined,
      metaData
    );

    console.log(`[MinIO] Uploaded '${objectName}' to bucket '${MINIO_BUCKET}'`);
    return { bucket: MINIO_BUCKET, objectName, etag: result.etag };
  } catch (err) {
    console.error('[MinIO] uploadFile error:', err.message);
    throw err;
  }
}

/**
 * Download a file from MinIO
 * @param {string} objectName - The object name/key
 * @returns {Promise<Buffer|null>} The file data as Buffer or null
 */
async function downloadFile(objectName) {
  if (!isConfigured()) {
    return stub('downloadFile')(objectName);
  }

  if (!client) {
    await connect();
    if (!client) return null;
  }

  try {
    const stream = await client.getObject(MINIO_BUCKET, objectName);

    return new Promise((resolve, reject) => {
      const chunks = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  } catch (err) {
    console.error('[MinIO] downloadFile error:', err.message);
    throw err;
  }
}

/**
 * Delete a file from MinIO
 * @param {string} objectName - The object name/key
 * @returns {Promise<boolean|null>} True if deleted or null
 */
async function deleteFile(objectName) {
  if (!isConfigured()) {
    return stub('deleteFile')(objectName);
  }

  if (!client) {
    await connect();
    if (!client) return null;
  }

  try {
    await client.removeObject(MINIO_BUCKET, objectName);
    console.log(`[MinIO] Deleted '${objectName}' from bucket '${MINIO_BUCKET}'`);
    return true;
  } catch (err) {
    console.error('[MinIO] deleteFile error:', err.message);
    throw err;
  }
}

/**
 * Generate a presigned URL for temporary access
 * @param {'GET'|'PUT'} method - HTTP method
 * @param {string} objectName - The object name/key
 * @param {number} [expiry=3600] - URL expiry in seconds (default 1 hour)
 * @returns {Promise<string|null>} The presigned URL or null
 */
async function getPresignedUrl(method, objectName, expiry = 3600) {
  if (!isConfigured()) {
    return stub('getPresignedUrl')(method, objectName, expiry);
  }

  if (!client) {
    await connect();
    if (!client) return null;
  }

  try {
    let url;
    if (method === 'GET') {
      url = await client.presignedGetObject(MINIO_BUCKET, objectName, expiry);
    } else if (method === 'PUT') {
      url = await client.presignedPutObject(MINIO_BUCKET, objectName, expiry);
    } else {
      throw new Error(`Unsupported method: ${method}. Use GET or PUT.`);
    }

    return url;
  } catch (err) {
    console.error('[MinIO] getPresignedUrl error:', err.message);
    throw err;
  }
}

// Export real or stub methods based on configuration
if (isConfigured()) {
  module.exports = { connect, uploadFile, downloadFile, deleteFile, getPresignedUrl };
} else {
  module.exports = {
    connect: stub('connect'),
    uploadFile: stub('uploadFile'),
    downloadFile: stub('downloadFile'),
    deleteFile: stub('deleteFile'),
    getPresignedUrl: stub('getPresignedUrl'),
  };
}
