/**
 * Redis cache middleware for Express
 * 
 * Usage: app.use("/api/data", cacheMiddleware(60), dataRoutes);
 * 
 * - GET requests are cached by URL + query string
 * - POST/PUT/DELETE requests invalidate the cache prefix
 * - Falls back gracefully when Redis is unavailable
 */
import Redis from "ioredis";

let redis = null;
let connected = false;

// Initialize Redis connection
function getRedis() {
  if (redis) return redis;
  
  const url = process.env.REDIS_URL;
  if (!url) {
    console.log("[cache] No REDIS_URL set, caching disabled");
    return null;
  }
  
  try {
    redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });
    
    redis.on("connect", () => {
      connected = true;
      console.log("[cache] Redis connected:", url.replace(/:[^:@]+@/, ":***@"));
    });
    
    redis.on("error", (err) => {
      if (connected) {
        console.error("[cache] Redis error:", err.message);
        connected = false;
      }
    });
    
    redis.on("close", () => {
      connected = false;
    });
    
    redis.connect().catch(() => {});
    return redis;
  } catch (err) {
    console.error("[cache] Failed to create Redis client:", err.message);
    return null;
  }
}

/**
 * Cache middleware factory
 * @param {number} ttl - Time-to-live in seconds (default: 60)
 * @param {string} prefix - Cache key prefix (default: derived from req.baseUrl)
 * @returns {Function} Express middleware
 */
export function cacheMiddleware(ttl = 60, prefix = null) {
  // Initialize Redis on first use
  getRedis();
  
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== "GET") {
      // For mutations, invalidate cache for this prefix
      if (["POST", "PUT", "DELETE", "PATCH"].includes(req.method) && redis && connected) {
        const cachePrefix = prefix || req.baseUrl;
        try {
          const keys = await redis.keys(`cache:${cachePrefix}:*`);
          if (keys.length > 0) {
            await redis.del(...keys);
          }
        } catch (err) {
          // Ignore cache invalidation errors
        }
      }
      return next();
    }
    
    // If Redis not available, skip caching
    if (!redis || !connected) {
      return next();
    }
    
    const cachePrefix = prefix || req.baseUrl;
    const cacheKey = `cache:${cachePrefix}:${req.originalUrl}`;
    
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const data = JSON.parse(cached);
        res.set("X-Cache", "HIT");
        return res.json(data);
      }
    } catch (err) {
      // Cache read error, proceed without cache
    }
    
    // Intercept res.json to cache the response
    const originalJson = res.json.bind(res);
    res.json = function (body) {
      // Cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300 && redis && connected) {
        redis.setex(cacheKey, ttl, JSON.stringify(body)).catch(() => {});
      }
      res.set("X-Cache", "MISS");
      return originalJson(body);
    };
    
    next();
  };
}

/**
 * Get Redis client for direct use (e.g., pub/sub, sessions)
 */
export function getRedisClient() {
  return getRedis();
}

/**
 * Health check for Redis
 */
export async function redisHealthCheck() {
  if (!redis || !connected) return { status: "disconnected" };
  try {
    await redis.ping();
    return { status: "connected" };
  } catch {
    return { status: "error" };
  }
}
