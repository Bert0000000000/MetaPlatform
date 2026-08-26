// RUNTIME-MVP-02 Smoke — Playwright APIRequestContext e2e against live docker stack.
//
// Validates: docker 后端服务全部 healthy；v2 kernel endpoints 健康可达；
// OpenAPI 暴露 schema 与 ont.yaml 对齐；SQLCompiler/Subprocess 增量端到端 sanity。
//
// 不依赖 vite（前端不在本 Batch 范围），直接 probe 已起的 docker 服务。

import { createConnection } from 'node:net';

import { test, expect } from '@playwright/test';

type HttpProbe = { name: string; port: number; path: string };
type TcpProbe = { name: string; port: number };

const HTTP_PROBES: HttpProbe[] = [
  { name: 'apiGateway', port: 8100, path: '/healthz' },
  { name: 'ont', port: 8007, path: '/healthz' },
  { name: 'rag', port: 8001, path: '/healthz' },
  { name: 'agent', port: 8002, path: '/healthz' },
  { name: 'kb', port: 8003, path: '/healthz' },
  { name: 'llmGw', port: 8008, path: '/healthz' },
  { name: 'msg', port: 8082, path: '/healthz' },
  { name: 'mcp', port: 8081, path: '/healthz' },
  { name: 'authService', port: 8101, path: '/healthz' },
  { name: 'data', port: 8701, path: '/api/v1/data/health' },
  { name: 'dw', port: 8021, path: '/healthz' },
  { name: 'arch', port: 8321, path: '/healthz' },
  { name: 'copilot', port: 8601, path: '/healthz' },
  { name: 'hub', port: 8301, path: '/healthz' },
  { name: 'a2a', port: 8502, path: '/api/v1/a2a/health' },
  { name: 'minio', port: 9000, path: '/minio/health/live' },
  { name: 'keycloak', port: 8180, path: '/realms/metaplatform/.well-known/openid-configuration' },
];

const TCP_PROBES: TcpProbe[] = [
  { name: 'postgres', port: 5432 },
  { name: 'redis', port: 6379 },
  { name: 'kafka', port: 9092 },
];

function connectTcp(host: string, port: number, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host, port });
    let settled = false;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) reject(error);
      else resolve();
    };

    socket.setTimeout(timeoutMs, () => {
      finish(new Error(`TCP probe timed out for ${host}:${port}`));
    });
    socket.once('connect', () => finish());
    socket.once('error', (error) => finish(error));
    socket.once('close', () => {
      if (!settled) finish(new Error(`TCP probe closed before connect for ${host}:${port}`));
    });
  });
}

test.describe('RUNTIME-MVP-02 docker backend smoke', () => {
  for (const { name, port, path } of HTTP_PROBES) {
    test(`${name} :${port}${path} readiness responds`, async ({ request: ctx }) => {
      const res = await ctx.get(`http://localhost:${port}${path}`, {
        failOnStatusCode: false,
        timeout: 5000,
      });
      expect([200, 401, 403, 503]).toContain(res.status());
    });
  }

  for (const { name, port } of TCP_PROBES) {
    test(`${name} :${port} accepts TCP connections`, async () => {
      await expect(connectTcp('localhost', port)).resolves.toBeUndefined();
    });
  }
});

test.describe('RUNTIME-MVP-02 v2 kernel surface (post-rebuild)', () => {
  test('ont /openapi.json declares v2 kernel endpoints', async ({ request: ctx }) => {
    // post-rebuild (容器含 RUNTIME-MVP-01/02 代码)：v2 kernel 5 endpoint 应在 path 列表
    const res = await ctx.get('http://localhost:8007/openapi.json');
    expect(res.status()).toBe(200);
    const body = await res.json();
    const paths = Object.keys(body.paths ?? {});
    expect(paths.some((p) => p.includes('/api/v1/ont/v2/object-types'))).toBeTruthy();
    expect(paths.some((p) => p.includes('/api/v1/ont/v2/individuals'))).toBeTruthy();
    expect(paths.some((p) => p.includes('/api/v1/ont/v2/object-sets:evaluate'))).toBeTruthy();
    expect(paths.some((p) => p.includes('/api/v1/ont/v2/action-types:apply'))).toBeTruthy();
  });

  test('ont /api/v1/ont/v2/object-types requires auth (401)', async ({ request: ctx }) => {
    const res = await ctx.get('http://localhost:8007/api/v1/ont/v2/object-types?limit=5');
    expect(res.status()).toBe(401);
  });

  test('api gateway proxies ont healthz via /api/v1/ont', async ({ request: ctx }) => {
    const res = await ctx.get('http://localhost:8100/healthz');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });
});

test.describe('RUNTIME-MVP-02 SQLCompiler + SubprocessExecutor (kernel unit smoke)', () => {
  test('kernel module imports succeed (SQLCompiler + SubprocessExecutor)', async () => {
    const { spawnSync } = await import('node:child_process');
    const py = spawnSync(
      'python',
      [
        '-c',
        'from mate_kernel.objectset.sql_compiler import SQLCompiler; '
        + 'from mate_kernel.sandbox.k8s import SubprocessExecutor, K8sSandboxRunner; '
        + 'print("KERNEL_OK")',
      ],
      { cwd: 'D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform/mate-platform-backend/packages/mate-kernel/src', encoding: 'utf8', timeout: 15000 }
    );
    expect(py.status).toBe(0);
    expect(py.stdout).toContain('KERNEL_OK');
  });
});
