const fs = require('fs');
const path = require('path');
const out = process.argv[2] || path.join(__dirname, '..', 'services', 'api-gateway', 'openapi', 'gateway.yaml');
const P = [];
P.push(`openapi: 3.1.0
info:
  title: mate-api-gateway
  version: 0.1.0
  description: |
    L7 API gateway: longest-prefix path routing + per-tenant rate limit (Redis).
    Catch-all proxy at /api/v1/{path:path}. Matched prefixes:
      /api/v1/rag/    -> RAG_URL
      /api/v1/agent/  -> AGENT_URL
      /api/v1/llm/    -> LLMGW_URL
      /api/v1/kb/     -> APP_KB_URL
      /api/v1/ont/    -> ONT_URL
      /api/v1/mcp/    -> MCP_URL
      /api/v1/admin/operations/ -> OBS_URL
      /api/v1/admin/  -> IAM_ADMIN_URL
      /api/v1/iam/    -> IAM_ADMIN_URL
servers:
  - url: http://localhost:8100
    description: local dev
  - url: http://mate-api-gateway:8100
    description: docker compose
tags:
  - name: meta
  - name: proxy
`);
P.push(`paths:
  /healthz:
    get:
      summary: Liveness probe
      tags: [meta]
      responses:
        "200": {description: OK}
  /readyz:
    get:
      summary: Probe every upstream + redis, return per-service status
      tags: [meta]
      responses:
        "200": {description: OK}
  /api/v1/{path}:
    parameters:
      - {in: path, name: path, required: true, schema: {type: string}}
    get:
      summary: Proxy GET to matched upstream
      tags: [proxy]
      responses:
        "200": {description: Upstream response}
        "404": {description: No route matched (E404_NO_ROUTE)}
        "429": {description: Rate limit exceeded (per tenant, 600/min by default)}
        "502": {description: Upstream error}
        "504": {description: Upstream timeout}
    post:
      summary: Proxy POST to matched upstream
      tags: [proxy]
      responses:
        "200": {description: Upstream response}
        "404": {description: No route matched}
        "429": {description: Rate limit exceeded}
        "502": {description: Upstream error}
        "504": {description: Upstream timeout}
    put:
      summary: Proxy PUT to matched upstream
      tags: [proxy]
      responses:
        "200": {description: Upstream response}
        "404": {description: No route matched}
        "429": {description: Rate limit exceeded}
        "502": {description: Upstream error}
        "504": {description: Upstream timeout}
    delete:
      summary: Proxy DELETE to matched upstream
      tags: [proxy]
      responses:
        "200": {description: Upstream response}
        "404": {description: No route matched}
        "429": {description: Rate limit exceeded}
        "502": {description: Upstream error}
        "504": {description: Upstream timeout}
    patch:
      summary: Proxy PATCH to matched upstream
      tags: [proxy]
      responses:
        "200": {description: Upstream response}
        "404": {description: No route matched}
        "429": {description: Rate limit exceeded}
        "502": {description: Upstream error}
        "504": {description: Upstream timeout}
    options:
      summary: Proxy OPTIONS to matched upstream
      tags: [proxy]
      responses:
        "200": {description: Upstream response}
`);

let raw = P.join('');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, raw, 'utf8');
if (raw.charCodeAt(0) === 0xFEFF) { fs.writeFileSync(out, raw.slice(1)); }
console.log('wrote', out, 'bytes', fs.statSync(out).size);
