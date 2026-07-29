const fs = require('fs');
const path = require('path');
const out = process.argv[2] || path.join(__dirname, '..', 'packages', 'mate-tech-obs', 'openapi', 'obs.yaml');
const P = [];
P.push(`openapi: 3.1.0
info:
  title: mate-tech-obs
  version: 0.1.0
  description: |
    Observability aggregation (OTel + Prometheus + Loki + Tempo).
    Two surfaces:
      /api/v1/obs/*        diagnostics for everyone
      /api/v1/admin/operations/*  admin dashboard tab
servers:
  - url: http://localhost:8083
    description: local dev
  - url: http://mate-tech-obs:8083
    description: docker compose
tags:
  - name: obs
  - name: admin-operations
  - name: meta
`);
P.push(`paths:
  /healthz:
    get:
      summary: Liveness probe
      tags: [meta]
      responses:
        "200": {description: OK}
  /metrics:
    get:
      summary: Prometheus metrics (text/plain)
      tags: [obs]
      responses:
        "200":
          description: text/plain exposition format
  /api/v1/obs/health:
    get:
      summary: Aggregated health (9 apps + 7 infra)
      tags: [obs]
      responses:
        "200": {description: OK}
  /api/v1/obs/instrument:
    get:
      summary: Auto-instrument status
      tags: [obs]
      responses:
        "200": {description: OK}
  /api/v1/admin/operations/health:
    get:
      summary: Operations health (per service)
      tags: [admin-operations]
      responses:
        "200": {description: OK}
  /api/v1/admin/operations/metrics/self:
    get:
      summary: Self process metrics snapshot
      tags: [admin-operations]
      responses:
        "200": {description: OK}
  /api/v1/admin/operations/alerts/rules:
    get:
      summary: List alert rules
      tags: [admin-operations]
      responses:
        "200": {description: OK}
  /api/v1/admin/operations/prometheus/query:
    get:
      summary: Prometheus passthrough (best-effort)
      tags: [admin-operations]
      parameters:
        - {in: query, name: query, required: true, schema: {type: string}, description: "PromQL expression"}
      responses:
        "200": {description: OK}
  /api/v1/admin/operations/capacity:
    get:
      summary: Capacity snapshot
      tags: [admin-operations]
      responses:
        "200": {description: OK}
`);

let raw = P.join('');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, raw, 'utf8');
if (raw.charCodeAt(0) === 0xFEFF) { fs.writeFileSync(out, raw.slice(1)); }
console.log('wrote', out, 'bytes', fs.statSync(out).size);
