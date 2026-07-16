/**
 * MinIO Object Storage Integration (ESM)
 *
 * Phase 2: Storage Layer Upgrade — S3-compatible object storage.
 *
 * Provides file upload, download, deletion, and presigned URL generation.
 * When MINIO_ENDPOINT is not configured, exports stub methods that log and return null.
 */

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || "";
const MINIO_PORT = parseInt(process.env.MINIO_PORT || "9000", 10);
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || "";
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || "";
const MINIO_BUCKET = process.env.MINIO_BUCKET || "metaplatform";
const MINIO_USE_SSL = process.env.MINIO_USE_SSL === "true";

let client = null;
let MinioLib = null;
let connected = false;

/**
 * Check if MinIO is configured via environment variables
 */
export function isConfigured() {
  return Boolean(MINIO_ENDPOINT && MINIO_ACCESS_KEY && MINIO_SECRET_KEY);
}

function stub(methodName) {
  return (...args) => {
    console.warn(`[MinIO] ${methodName}: Service not configured. Args:`, JSON.stringify(args.slice(0, 2)));
    return null;
  };
}

/**
 * Connect to MinIO and ensure the default bucket exists
 */
export async function connect() {
  if (!isConfigured()) {
    console.warn("[MinIO] connect: Service not configured");
    return null;
  }

  if (client && connected) return client;

  try {
    if (!MinioLib) {
      try {
        MinioLib = await import("minio");
      } catch (e) {
        console.error("[MinIO] minio package not installed.");
        return null;
      }
    }

    client = new MinioLib.Client({
      endPoint: MINIO_ENDPOINT,
      port: MINIO_PORT,
      useSSL: MINIO_USE_SSL,
      accessKey: MINIO_ACCESS_KEY,
      secretKey: MINIO_SECRET_KEY,
    });

    // Ensure bucket exists
    const exists = await client.bucketExists(MINIO_BUCKET);
    if (!exists) {
      await client.makeBucket(MINIO_BUCKET, "us-east-1");
      console.log(`[MinIO] Created bucket '${MINIO_BUCKET}'`);
    }

    connected = true;
    console.log(`[MinIO] Connected to ${MINIO_ENDPOINT}:${MINIO_PORT}, bucket: ${MINIO_BUCKET}`);
    return client;
  } catch (err) {
    console.error("[MinIO] Connection failed:", err.message);
    client = null;
    connected = false;
    return null;
  }
}

/**
 * Upload a file to MinIO
 * @param {string} objectName - Object key
 * @param {Buffer|ReadableStream|string} data
 * @param {object} [meta] - { contentType, metadata }
 */
export async function uploadFile(objectName, data, meta = {}) {
  if (!isConfigured()) return stub("uploadFile")(objectName, data, meta);
  if (!client) {
    await connect();
    if (!client) return null;
  }

  try {
    const metaData = {
      "Content-Type": meta.contentType || "application/octet-stream",
      ...(meta.metadata || {}),
    };
    const size = Buffer.isBuffer(data) ? data.length : undefined;

    const result = await client.putObject(
      MINIO_BUCKET,
      objectName,
      data,
      size,
      metaData
    );

    console.log(`[MinIO] Uploaded '${objectName}' -> ${MINIO_BUCKET}`);
    return { bucket: MINIO_BUCKET, objectName, etag: result.etag, size };
  } catch (err) {
    console.error("[MinIO] uploadFile error:", err.message);
    throw err;
  }
}

/**
 * Download a file from MinIO as a Buffer
 */
export async function downloadFile(objectName) {
  if (!isConfigured()) return stub("downloadFile")(objectName);
  if (!client) {
    await connect();
    if (!client) return null;
  }
  try {
    const stream = await client.getObject(MINIO_BUCKET, objectName);
    return new Promise((resolve, reject) => {
      const chunks = [];
      stream.on("data", (chunk) => chunks.push(chunk));
      stream.on("end", () => resolve(Buffer.concat(chunks)));
      stream.on("error", reject);
    });
  } catch (err) {
    console.error("[MinIO] downloadFile error:", err.message);
    throw err;
  }
}

/**
 * Delete a file from MinIO
 */
export async function deleteFile(objectName) {
  if (!isConfigured()) return stub("deleteFile")(objectName);
  if (!client) {
    await connect();
    if (!client) return null;
  }
  try {
    await client.removeObject(MINIO_BUCKET, objectName);
    console.log(`[MinIO] Deleted '${objectName}'`);
    return true;
  } catch (err) {
    console.error("[MinIO] deleteFile error:", err.message);
    throw err;
  }
}

/**
 * Generate a presigned URL for temporary access
 */
export async function getPresignedUrl(method, objectName, expiry = 3600) {
  if (!isConfigured()) return stub("getPresignedUrl")(method, objectName, expiry);
  if (!client) {
    await connect();
    if (!client) return null;
  }
  try {
    let url;
    if (method === "GET") {
      url = await client.presignedGetObject(MINIO_BUCKET, objectName, expiry);
    } else if (method === "PUT") {
      url = await client.presignedPutObject(MINIO_BUCKET, objectName, expiry);
    } else {
      throw new Error(`Unsupported method: ${method}. Use GET or PUT.`);
    }
    return url;
  } catch (err) {
    console.error("[MinIO] getPresignedUrl error:", err.message);
    throw err;
  }
}

/**
 * List objects in the bucket with optional prefix filter
 */
export async function listObjects(prefix = "", recursive = true) {
  if (!isConfigured()) return stub("listObjects")(prefix, recursive);
  if (!client) {
    await connect();
    if (!client) return null;
  }
  try {
    const objects = [];
    const stream = client.listObjectsV2(MINIO_BUCKET, prefix, recursive);
    return new Promise((resolve, reject) => {
      stream.on("data", (obj) => objects.push(obj));
      stream.on("end", () => resolve(objects));
      stream.on("error", reject);
    });
  } catch (err) {
    console.error("[MinIO] listObjects error:", err.message);
    throw err;
  }
}

/**
 * Get object metadata
 */
export async function statObject(objectName) {
  if (!isConfigured()) return stub("statObject")(objectName);
  if (!client) {
    await connect();
    if (!client) return null;
  }
  try {
    return await client.statObject(MINIO_BUCKET, objectName);
  } catch (err) {
    console.error("[MinIO] statObject error:", err.message);
    throw err;
  }
}

/**
 * Health check
 */
export async function healthCheck() {
  if (!isConfigured()) return { status: "disabled" };
  try {
    if (!client) await connect();
    if (!client) return { status: "unreachable" };
    const exists = await client.bucketExists(MINIO_BUCKET);
    return {
      status: "connected",
      endpoint: `${MINIO_ENDPOINT}:${MINIO_PORT}`,
      bucket: MINIO_BUCKET,
      bucketExists: exists,
    };
  } catch (err) {
    return { status: "error", error: err.message };
  }
}

export default {
  isConfigured,
  connect,
  uploadFile,
  downloadFile,
  deleteFile,
  getPresignedUrl,
  listObjects,
  statObject,
  healthCheck,
};