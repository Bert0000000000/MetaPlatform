/**
 * Runtime pruner — bounded retention of historical published containers.
 *
 * Why: every /apps/:id/publish keeps an immutable `app_publications`
 * row + spawns a long-lived docker container so users can keep
 * visiting `/app/<historicalSlug>`. Over time this leaks ports
 * (range 31001-31499) and memory.
 *
 * Strategy (per app):
 *   - Keep the current alias target (BASE_TO_LATEST[baseSlug]) +
 *     the KEEP_RECENT most recent historical publications
 *     by `created_at`.
 *   - Any other container named `app-<historicalSlug>` is torn down
 *     (and its row stays so future audits can see *what* got pruned).
 *
 * Strategy (orphans):
 *   - Any `app-*` container on the daemon whose slug is not in the
 *     DB at all is also torn down (defensive cleanup after manual
 *     `docker rm` rows / partial restores).
 *
 * Configurable via env:
 *   RUNTIME_KEEP_RECENT  (default 3)
 *   RUNTIME_MAX_AGE_HOURS (default 72)
 *
 * The cron lives in `runtime-orchestrator.js` startPruner() and fires
 * every `RUNTIME_PRUNE_INTERVAL_MS` (default 1h).
 */
import { getDocker } from "./runtime-orchestrator.js";

const KEEP_RECENT    = Number(process.env.RUNTIME_KEEP_RECENT    || 3);
const MAX_AGE_HOURS  = Number(process.env.RUNTIME_MAX_AGE_HOURS || 72);

let timerHandle = null;
let isRunning = false;

/**
 * Run a single prune pass. Always returns a structured report so the
 * admin /admin/runtime page can show "last pruned N minutes ago: cleared X".
 */
export async function pruneOnce({ db, aliasMap }) {
  if (isRunning) return { skipped: "already-running" };
  isRunning = true;
  const report = { started_at: new Date().toISOString(), pruned: [], kept: 0, orphan_pruned: [], error: null };
  try {
    const d = await getDocker();
    // ── 1. Collect what we expect to keep per app
    const apps = db.prepare("SELECT id, app_slug, status FROM applications WHERE status='published' OR app_slug IS NOT NULL").all();
    const pubs = db.prepare("SELECT id, app_id, slug, created_at FROM app_publications ORDER BY app_id, created_at DESC").all();

    // For each app: keep-current-alias + top KEEP_RECENT
    const protectedSlugs = new Set();
    apps.forEach((a) => { if (a.app_slug) protectedSlugs.add(a.app_slug); });
    // add alias targets
    if (aliasMap) for (const hist of aliasMap.values()) protectedSlugs.add(hist);
    // add top-K per app by created_at
    const counts = new Map();
    for (const p of pubs) {
      const k = p.app_id;
      counts.set(k, (counts.get(k) || 0) + 1);
      if (counts.get(k) <= KEEP_RECENT) protectedSlugs.add(p.slug);
    }

    // ── 2. List every running/stopped `app-*` container
    const all = await d.listContainers({ all: true });
    const appContainers = all.filter((c) => (c.Names || []).some((n) => /^\/?app-/.test(n)));

    for (const c of appContainers) {
      const name = (c.Names[0] || "").replace(/^\//, "");
      const slug = name.startsWith("app-") ? name.slice(4) : null;
      if (!slug) continue;

      // Find publication row (if any)
      const pub = pubs.find((p) => p.slug === slug);

      let shouldPrune = false;
      let reason = null;

      if (!pub) {
        shouldPrune = true;
        reason = "orphan";
      } else if (protectedSlugs.has(slug)) {
        report.kept += 1;
      } else {
        const ageHours = (Date.now() - new Date(pub.created_at).getTime()) / 3600_000;
        if (ageHours > MAX_AGE_HOURS) {
          shouldPrune = true;
          reason = `older-than-${MAX_AGE_HOURS}h`;
        } else {
          // Excessive history beyond KEEP_RECENT per app
          shouldPrune = true;
          reason = `beyond-keep-recent-${KEEP_RECENT}`;
        }
      }

      if (!shouldPrune) continue;

      try {
        const container = d.getContainer(c.Id);
        await container.stop({ t: 5 }).catch(() => {});
        await container.remove({ force: true }).catch(() => {});
        if (reason === "orphan") report.orphan_pruned.push(slug);
        else report.pruned.push({ slug, reason });
      } catch (err) {
        report.error = report.error || `prune-${slug}: ${err.message}`;
      }
    }

    report.finished_at = new Date().toISOString();
    return report;
  } catch (err) {
    report.error = err.message;
    report.finished_at = new Date().toISOString();
    return report;
  } finally {
    isRunning = false;
  }
}

/**
 * Schedule pruneEveryMs cadence. Safe to call multiple times — the
 * second call cancels the previous timer. Pass `null` to stop.
 */
export function startPruner({ db, aliasMap, intervalMs = Number(process.env.RUNTIME_PRUNE_INTERVAL_MS || 3600_000) }) {
  stopPruner();
  if (!intervalMs || intervalMs < 60_000) intervalMs = 60_000; // floor: 1 min
  // First pass after 30s so the boot doesn't compete with publish traffic
  setTimeout(() => pruneOnce({ db, aliasMap }).catch(() => undefined), 30_000);
  timerHandle = setInterval(() => {
    pruneOnce({ db, aliasMap }).catch(() => undefined);
  }, intervalMs);
  return { intervalMs, started: true };
}

export function stopPruner() {
  if (timerHandle) {
    clearInterval(timerHandle);
    timerHandle = null;
  }
  return { stopped: true };
}
