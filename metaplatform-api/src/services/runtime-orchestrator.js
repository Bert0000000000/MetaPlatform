/**
 * Runtime orchestrator.
 *
 * Spawns / stops / inspects one Docker container per published
 * application, on the local docker daemon (Docker-Desktop on dev /
 * a worker node on prod).
 *
 *   spawnRuntime({ slug, app, snapshotFile }) -> { containerId, port, state, snapshot }
 *   stopRuntime(slug)                          -> { removed: bool }
 *   inspectRuntime(slug)                       -> { state, port, containerId }
 *   resolveTarget(slug)                        -> { mode: 'container' | 'degraded' | 'missing', port?, snapshot? }
 *
 * If the docker daemon is unreachable we return `degraded: true` and
 * the caller falls back to reading the snapshot sqlite directly out of
 * the platform process. That fallback path makes dev work even when a
 * user opens their laptop without Docker started.
 */
import fs from "node:fs";
import http from "node:http";
import { snapshotPath } from "./publish-snapshot.js";

const RUNTIME_IMAGE   = process.env.METAPLATFORM_RUNTIME_IMAGE  || "metaplatform-runtime:v1";
const DOCKER_HOST     = process.env.DOCKER_HOST                 || null; // dockerode default
const NETWORK_NAME    = process.env.METAPLATFORM_RUNTIME_NETWORK || "bridge";

const HOST_PORT_BASE  = Number(process.env.METAPLATFORM_RUNTIME_PORT_BASE || 31001);
const HOST_PORT_RANGE = Number(process.env.METAPLATFORM_RUNTIME_PORT_RANGE || 500);

function slugToPort(slug) {
  // djb2-ish; deterministic and bounded so we don't collide across
  // publish/unpublish cycles for two apps with similar slugs.
  let h = 5381;
  for (let i = 0; i < slug.length; i++) {
    h = ((h << 5) + h + slug.charCodeAt(i)) & 0x7fffffff;
  }
  return HOST_PORT_BASE + (h % HOST_PORT_RANGE);
}

/**
 * Convert a Windows path into a POSIX-style path the linux docker
 * daemon on Docker-Desktop will accept for bind mounts. We confirmed
 * this is needed: `D:\Hermes\...\slug.db` is silently coerced into a
 * not-quite-correct mount that the docker daemon then rejects at
 * container creation. The clean form is `/d/Hermes/.../slug.db`.
 *
 * On non-Windows hosts we leave the path alone — Linux paths already
 * look the way docker expects.
 */
function toDockerBindPath(p) {
  if (process.platform !== "win32") return p;
  const m = /^([A-Za-z]):\\(.*)$/.exec(p);
  if (!m) return p.replace(/\\/g, "/");
  const drive = m[1].toLowerCase();
  const rest  = m[2].replace(/\\/g, "/");
  return `/${drive}/${rest}`;
}

// In-process record of slug → containerId/port. The platform process is
// the single source of truth; on startup it tries to reattach to any
// containers that already exist.
const REGISTRY = new Map(); // slug -> { containerId, port, snapshotPath }

let docker = null;
let dockerProbe = null;

/**
 * Lazy dockerode import. We do NOT throw on import failure; the rest of
 * the orchestrator treats it as "degraded" and falls back.
 */
async function getDocker() {
  if (docker) return docker;
  const { default: Docker } = await import("dockerode");
  docker = new Docker(DOCKER_HOST ? { host: DOCKER_HOST } : undefined);
  return docker;
}

async function probe() {
  if (dockerProbe) return dockerProbe;
  try {
    const d = await getDocker();
    await d.ping();
    dockerProbe = { ok: true };
  } catch (err) {
    dockerProbe = { ok: false, error: err.message };
  }
  return dockerProbe;
}

/**
 * On boot, ask the docker daemon for any `app-<slug>` container that's
 * already running (left over from a previous process / restart) and
 * register it in REGISTRY. This lets the platform survive restarts
 * without losing runtime state.
 */
export async function reattach() {
  const p = await probe();
  if (!p.ok) return { reattached: [], degraded: true, error: p.error };
  const d = await getDocker();
  let containers = [];
  try {
    containers = await d.listContainers({ all: true, filters: { name: ["app-"] } });
  } catch (err) {
    return { reattached: [], degraded: true, error: err.message };
  }
  const reattached = [];
  for (const c of containers) {
    const name = (c.Names || []).map((n) => n.replace(/^\//, "")).find((n) => n.startsWith("app-"));
    if (!name) continue;
    const slug = name.slice("app-".length);
    const publicPort = (c.Ports || [])
      .filter((pp) => pp.PublicPort && pp.Type === "tcp" && pp.IP === "0.0.0.0")
      .map((pp) => pp.PublicPort)[0];
    REGISTRY.set(slug, {
      containerId: c.Id,
      port: publicPort || null,
      snapshotPath: snapshotPath(slug),
    });
    reattached.push({ slug, port: publicPort, state: c.State });
  }
  return { reattached, degraded: false };
}

export async function spawnRuntime({ slug, app, snapshotFile }) {
  const p = await probe();
  if (!p.ok) {
    return { degraded: true, error: p.error, snapshot: snapshotFile };
  }
  const d = await getDocker();

  // Determine a free host port deterministically, but if the slot is
  // already in use by a third-party container, walk forward.
  const desired = slugToPort(slug);
  let port = desired;
  for (let attempt = 0; attempt < HOST_PORT_RANGE; attempt++) {
    const candidate = desired + attempt;
    try {
      const occupied = await d.listContainers({
        all: false,
        filters: { port: [String(candidate)] },
      });
      if (!occupied.length) { port = candidate; break; }
    } catch {/* ignore */}
  }

  // Tear down any previous container with the same name (idempotent
  // re-publish).
  try {
    const old = d.getContainer(`app-${slug}`);
    await old.stop({ t: 5 }).catch(() => {});
    await old.remove({ force: true }).catch(() => {});
  } catch {/* none */}

  // Bind-mount the snapshot file as `/data/app.db` (read-only). Each
  // runtime sees only one file.
  const hostBind = toDockerBindPath(snapshotFile);

  const container = await d.createContainer({
    Image: RUNTIME_IMAGE,
    name: `app-${slug}`,
    Env: [
      `APP_ID=${app.id}`,
      `APP_SLUG=${slug}`,
      `RUNTIME_DB_PATH=/data/app.db`,
    ],
    ExposedPorts: { "3000/tcp": {} },
    HostConfig: {
      AutoRemove: false,
      ReadonlyRootfs: true,
      Tmpfs: { "/tmp": "size=64m,mode=1777" },
      PortBindings: { "3000/tcp": [{ HostPort: String(port) }] },
      // 0.5 vCPU
      CpuQuota:  50000,
      // 256 MiB
      Memory:    268435456,
      SecurityOpt: ["no-new-privileges:true"],
      NetworkMode: NETWORK_NAME,
      Binds: [`${hostBind}:/data/app.db:ro`],
    },
    User: "1000:1000",
  });

  await container.start();
  const info = await container.inspect();
  REGISTRY.set(slug, { containerId: container.id, port, snapshotPath: snapshotFile });

  // Wait briefly for the runtime to come up. Without this, the caller
  // sees a "running" container whose port is not yet accepting
  // connections — which the reverse-proxy will turn into a 502.
  await waitForHealth(port, 5000).catch((err) => {
    // Not fatal — `state` still says `running`; the runtime will keep
    // catching up. Just attach the warning to the spawn return so the
    // UI can surface it.
    info.__healthWaitError = err.message;
  });

  return {
    degraded: false,
    containerId: container.id,
    port,
    state: info.State,
    snapshot: snapshotFile,
  };
}

export async function stopRuntime(slug) {
  const reg = REGISTRY.get(slug);
  if (!reg) return { removed: false, reason: "not registered" };
  const p = await probe();
  if (!p.ok) {
    REGISTRY.delete(slug);
    return { removed: false, degraded: true, error: p.error };
  }
  const d = await getDocker();
  try {
    const c = d.getContainer(reg.containerId);
    await c.stop({ t: 5 }).catch(() => {});
    await c.remove({ force: true }).catch(() => {});
  } catch (err) {
    REGISTRY.delete(slug);
    return { removed: false, error: err.message };
  }
  REGISTRY.delete(slug);
  return { removed: true };
}

export async function inspectRuntime(slug) {
  const reg = REGISTRY.get(slug);
  if (!reg) return { state: "absent", port: null };
  const p = await probe();
  if (!p.ok) return { ...reg, state: "degraded", error: p.error };
  const d = await getDocker();
  try {
    const info = await d.getContainer(reg.containerId).inspect();
    return {
      ...reg,
      state: info.State.Status,
      running: info.State.Running,
      startedAt: info.State.StartedAt,
      finishedAt: info.State.FinishedAt,
    };
  } catch (err) {
    return { ...reg, state: "missing", error: err.message };
  }
}

export async function listRuntimes() {
  return [...REGISTRY.entries()].map(([slug, v]) => ({ slug, ...v }));
}

/**
 * Wait until `http://127.0.0.1:port/health` responds with 200 within
 * `timeoutMs`. Polls every 250ms. Throws on timeout.
 */
function waitForHealth(port, timeoutMs) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      const req = http.request(
        { host: "127.0.0.1", port, method: "GET", path: "/health", timeout: 1000 },
        (res) => {
          // Drain body so the socket can close cleanly.
          res.resume();
          if (res.statusCode === 200) return resolve();
          if (Date.now() - started > timeoutMs) return reject(new Error(`timeout after ${timeoutMs}ms (status=${res.statusCode})`));
          setTimeout(tick, 250);
        },
      );
      req.on("error", () => {
        if (Date.now() - started > timeoutMs) return reject(new Error(`timeout after ${timeoutMs}ms (no listener)`));
        setTimeout(tick, 250);
      });
      req.end();
    };
    tick();
  });
}


/**
 * Resolve where to forward a `/app/<slug>` request. Tries the
 * container first; if it's down or absent and a snapshot file is on
 * disk, returns the snapshot location so the platform can serve a
 * read-only degraded response from its own process.
 */
export async function resolveTarget(slug) {
  const reg = REGISTRY.get(slug);
  const snap = snapshotPath(slug);
  const snapExists = fs.existsSync(snap);

  if (!reg) {
    return snapExists
      ? { mode: "degraded", snapshot: snap, port: null }
      : { mode: "missing", snapshot: null, port: null };
  }
  const p = await probe();
  if (!p.ok) {
    return snapExists
      ? { mode: "degraded", snapshot: snap, port: null, error: p.error }
      : { mode: "missing", snapshot: null, port: null, error: p.error };
  }
  const d = await getDocker();
  try {
    const info = await d.getContainer(reg.containerId).inspect();
    if (info.State.Running) {
      return { mode: "container", port: reg.port, snapshot: snap };
    }
  } catch {/* treat as missing */}
  return snapExists
    ? { mode: "degraded", snapshot: snap, port: null }
    : { mode: "missing", snapshot: null, port: null };
}
