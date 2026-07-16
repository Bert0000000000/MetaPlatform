/**
 * Observability — Barrel file (Phase 5)
 */
export * as metrics from "./metrics.js";
export * as logger from "./logger.js";
export * as tracer from "./tracer.js";
export * as audit from "./audit.js";

import { logger as loggerMod } from "./logger.js";
import { metrics as metricsMod } from "./metrics.js";
import { tracer as tracerMod } from "./tracer.js";
import { audit as auditMod } from "./audit.js";

/**
 * Aggregate status of all observability subsystems.
 */
export function getStatus() {
  return {
    metrics: metricsMod.getStatus?.() || { ok: true },
    logger: loggerMod.getStatus?.() || { ok: true },
    tracer: tracerMod.getStatus?.() || { ok: true },
    audit: auditMod.getStatus?.() || { ok: true },
    timestamp: new Date().toISOString(),
  };
}

export default {
  metrics: metricsMod,
  logger: loggerMod,
  tracer: tracerMod,
  audit: auditMod,
  getStatus,
};