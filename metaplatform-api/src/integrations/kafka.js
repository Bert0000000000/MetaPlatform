/**
 * Kafka Event Bus Integration (ESM)
 *
 * Phase 2: Storage Layer Upgrade — Production-grade event streaming.
 *
 * Provides producer (publish) and consumer (subscribe) capabilities.
 * Reuses the existing `mp-kafka-spike` broker (KRaft mode, single-node).
 *
 * Topic naming convention:
 *   metaplatform.{domain}.{action}
 *   e.g. metaplatform.knowledge.indexed, metaplatform.process.completed
 */

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || "localhost:9092")
  .split(",")
  .map((s) => s.trim());
const KAFKA_CLIENT_ID = process.env.KAFKA_CLIENT_ID || "metaplatform-api";
const KAFKA_GROUP_ID = process.env.KAFKA_GROUP_ID || "metaplatform-api-consumers";

let kafkaLib = null;
let producer = null;
let producerReady = false;
const consumers = []; // active consumer instances

export function isConfigured() {
  return KAFKA_BROKERS.length > 0;
}

export async function connect() {
  if (!isConfigured()) {
    console.warn("[Kafka] connect: KAFKA_BROKERS not set");
    return null;
  }
  try {
    if (!kafkaLib) {
      try {
        kafkaLib = await import("kafkajs");
      } catch (e) {
        console.error("[Kafka] kafkajs package not installed.");
        return null;
      }
    }
    if (producer && producerReady) return producer;

    const { Kafka, logLevel } = kafkaLib;
    const kafka = new Kafka({
      clientId: KAFKA_CLIENT_ID,
      brokers: KAFKA_BROKERS,
      logLevel: logLevel.WARN,
      retry: { retries: 5, initialRetryTime: 300 },
    });

    producer = kafka.producer({ allowAutoTopicCreation: true });
    // Race connect against a 10s timeout — prevents broker hang blocking API
    try {
      await Promise.race([
        producer.connect(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("kafka_connect_timeout_10s")), 10000)
        ),
      ]);
    } catch (err) {
      producer = null;
      console.warn(`[Kafka] connect skipped (${err.message})`);
      return null;
    }
    producerReady = true;
    console.log(`[Kafka] Producer connected to ${KAFKA_BROKERS.join(",")}`);

    // Stash a singleton kafka instance for consumers
    producer._kafka = kafka;
    return producer;
  } catch (err) {
    console.error("[Kafka] Connection failed:", err.message);
    producer = null;
    producerReady = false;
    return null;
  }
}

/**
 * Publish an event to a topic.
 * @param {string} topic - Kafka topic
 * @param {object|object[]} messages - Single message or array of messages
 * @param {object} [message] { key?, value, headers?, partition? }
 */
export async function publish(topic, messages) {
  if (!producer) {
    const ok = await connect();
    if (!ok) {
      console.warn(`[Kafka] publish skipped (no producer) topic=${topic}`);
      return { sent: 0, status: "unavailable" };
    }
  }
  const arr = Array.isArray(messages) ? messages : [messages];
  const payload = arr.map((m) => ({
    key: m.key || null,
    value: typeof m.value === "string" ? m.value : JSON.stringify(m.value),
    headers: m.headers || {},
    partition: m.partition,
  }));
  try {
    // Race producer.send against a 5s timeout so a hung broker doesn't
    // block the API event loop (CDC polls every 5s).
    const sendPromise = producer.send({ topic, messages: payload });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("publish_timeout_5s")), 5000)
    );
    const result = await Promise.race([sendPromise, timeoutPromise]);
    return {
      sent: payload.length,
      topic,
      partitionOffsets: result,
      status: "ok",
    };
  } catch (err) {
    console.error(`[Kafka] publish error topic=${topic}:`, err.message);
    throw err;
  }
}

/**
 * Subscribe to a topic. The handler is invoked for each message batch.
 * Returns a function to stop the consumer.
 */
export async function subscribe(topics, handler, options = {}) {
  if (!producer) await connect();
  if (!producer) {
    console.warn("[Kafka] subscribe skipped (no producer)");
    return () => {};
  }
  const kafka = producer._kafka;
  const { Kafka } = kafkaLib;

  const consumer = kafka.consumer({
    groupId: options.groupId || KAFKA_GROUP_ID,
    sessionTimeout: options.sessionTimeout || 30000,
    heartbeatInterval: options.heartbeatInterval || 3000,
  });
  await consumer.connect();
  const topicList = Array.isArray(topics) ? topics : [topics];
  for (const t of topicList) {
    await consumer.subscribe({ topic: t, fromBeginning: options.fromBeginning || false });
  }
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const valueStr = message.value?.toString("utf8") || "";
      let parsed;
      try {
        parsed = JSON.parse(valueStr);
      } catch {
        parsed = valueStr;
      }
      try {
        await handler({
          topic,
          partition,
          offset: message.offset,
          key: message.key?.toString("utf8") || null,
          value: parsed,
          headers: Object.fromEntries(
            Object.entries(message.headers || {}).map(([k, v]) => [
              k,
              Buffer.isBuffer(v) ? v.toString("utf8") : v,
            ])
          ),
          timestamp: message.timestamp,
        });
      } catch (err) {
        console.error(`[Kafka] handler error topic=${topic}:`, err.message);
      }
    },
  });
  consumers.push(consumer);
  console.log(`[Kafka] Subscribed to ${topicList.join(", ")} (group=${options.groupId || KAFKA_GROUP_ID})`);
  return async () => {
    try {
      await consumer.disconnect();
      const idx = consumers.indexOf(consumer);
      if (idx >= 0) consumers.splice(idx, 1);
      console.log(`[Kafka] Unsubscribed from ${topicList.join(", ")}`);
    } catch (err) {
      console.error("[Kafka] unsubscribe error:", err.message);
    }
  };
}

/**
 * Close producer and all consumers
 */
export async function close() {
  for (const c of consumers) {
    try {
      await c.disconnect();
    } catch (e) {
      // ignore
    }
  }
  consumers.length = 0;
  if (producer) {
    try {
      await producer.disconnect();
    } catch (e) {
      // ignore
    }
    producer = null;
    producerReady = false;
  }
  console.log("[Kafka] All connections closed");
}

/**
 * Health check (admin metadata fetch)
 */
export async function healthCheck() {
  if (!isConfigured()) return { status: "disabled" };
  try {
    if (!producer) await connect();
    if (!producer) return { status: "unreachable" };
    const kafka = producer._kafka;
    const admin = kafka.admin();
    await admin.connect();
    const topics = await admin.listTopics();
    await admin.disconnect();
    return {
      status: "connected",
      brokers: KAFKA_BROKERS,
      clientId: KAFKA_CLIENT_ID,
      topicCount: topics.length,
      activeConsumers: consumers.length,
    };
  } catch (err) {
    return { status: "error", error: err.message };
  }
}

// ── Domain-specific helpers ──────────────────────────────────

export async function emitKnowledgeIndexed(payload) {
  return publish("metaplatform.knowledge.indexed", {
    key: payload.id,
    value: { event: "knowledge.indexed", ...payload, emitted_at: new Date().toISOString() },
  });
}

export async function emitOntologyUpdated(payload) {
  return publish("metaplatform.ontology.updated", {
    key: payload.id,
    value: { event: "ontology.updated", ...payload, emitted_at: new Date().toISOString() },
  });
}

export async function emitProcessCompleted(payload) {
  return publish("metaplatform.process.completed", {
    key: payload.processInstanceId,
    value: { event: "process.completed", ...payload, emitted_at: new Date().toISOString() },
  });
}

export async function emitFileUploaded(payload) {
  return publish("metaplatform.file.uploaded", {
    key: payload.objectName,
    value: { event: "file.uploaded", ...payload, emitted_at: new Date().toISOString() },
  });
}

export default {
  isConfigured,
  connect,
  publish,
  subscribe,
  close,
  healthCheck,
  emitKnowledgeIndexed,
  emitOntologyUpdated,
  emitProcessCompleted,
  emitFileUploaded,
};