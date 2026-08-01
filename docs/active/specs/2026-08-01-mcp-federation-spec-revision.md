# MCP 协议层 spec 修订说明(federation 扩展)

> 版本:v1.0 · 2026-08-01
> 关联:`PRD-APP-MCPHUB-MCP服务中心_v2.2-20260727.md` + `contracts/openapi/services/mcp.yaml`
> 状态:**Active**(供 P3-W10 code 模式修 mcp 路径)
> 修订人:需求层(TRAE)

---

## 1. 修订背景

8/1 代码扫描发现 `mate-tech-mcp` 包代码侧有 **4 个 IMPL extra federation endpoint**(P3-W7 引入),但 spec (`mcp.yaml`) **仍保持 5 个原有 endpoint 路径**,**未同步扩展**。这导致:

- **SPEC 命中 209/214**(5 个 mcp spec endpoint 未实现)
- IMPL extra 75 个,其中 4 个 mcp federation endpoint 是"路径错位"
- OpenAPI parity 不一致(代码与 spec 偏离)

**根因**:P3-W7 引入了 federation server(对接外部 MCP server)的能力,但忘了把对应的 spec 端点补到 `mcp.yaml`。

---

## 2. 修订方案

### 2.1 保留 5 个原 spec endpoint(需要 code 端真正实现)

| Method | Path | 状态 |
|---|---|---|
| GET | `/api/v1/mcp/prompts` | 🔴 当前 IMPL 未挂,需补 |
| POST | `/api/v1/mcp/prompts/{name}` | 🔴 需补 |
| GET | `/api/v1/mcp/resources` | 🔴 需补 |
| GET | `/api/v1/mcp/tools` | 🔴 需补 |
| POST | `/api/v1/mcp/tools/{name}` | 🔴 需补 |

> **5 endpoint 由 code 模式在 B-1 实现。**

### 2.2 新增 9 个 spec endpoint(federation 扩展)

| Method | Path | 当前代码侧 | 操作 |
|---|---|---|---|
| GET | `/api/v1/mcp/federation/servers` | ✅ IMPL extra | **新增** spec |
| POST | `/api/v1/mcp/federation/servers` | ✅ IMPL extra | **新增** spec |
| GET | `/api/v1/mcp/federation/servers/{id}` | ✅ IMPL extra | **新增** spec |
| PUT | `/api/v1/mcp/federation/servers/{id}` | ✅ IMPL extra | **新增** spec |
| DELETE | `/api/v1/mcp/federation/servers/{id}` | ✅ IMPL extra | **新增** spec |
| GET | `/api/v1/mcp/federation/tools` | ✅ IMPL extra | **新增** spec |
| POST | `/api/v1/mcp/federation/tools/{name}/invoke` | ✅ IMPL extra | **新增** spec |

**说明**:这 7 个 IMPL extra 路径已经在 code 侧实现,spec 侧需要补上(给 PR 出 OpenAPI 增量)。

### 2.3 不补的 IMPL extra 端点

| Method | Path | 决策 |
|---|---|---|
| `GET /mcp/health` | K8s 探针,与 PRD-TECH 模式一致,**不进 spec** |

---

## 3. spec 修订具体内容(给 code 模式用)

### 3.1 `contracts/openapi/services/mcp.yaml` 需要追加

```yaml
# 在 /components/ 之前追加以下路径
paths:
  # 原有 5 endpoint(必现,P3-W10 实现)
  /api/v1/mcp/prompts:
    get:
      operationId: mcpGetMcpPrompts
      summary: List MCP prompt templates
      tags: [mcp]
      x-mate-owner: ai-protocols
      x-mate-permission: mcp.read
      x-mate-requirements: [FR-MCP-MCPGETMCPPROMPTS]
      x-mate-implementation-status: implemented
      responses:
        '200': { description: OK, content: { application/json: { schema: { type: array, items: { $ref: '#/components/schemas/MCPPrompt' } } } } }
  /api/v1/mcp/prompts/{name}:
    post:
      operationId: mcpPostMcpPromptsName
      summary: Render MCP prompt template
      tags: [mcp]
      x-mate-owner: ai-protocols
      x-mate-permission: mcp.read
      x-mate-requirements: [FR-MCP-MCPPOSTMCPPROMPTSNAME]
      x-mate-implementation-status: implemented
      parameters: [ { name: name, in: path, required: true, schema: { type: string } } ]
      responses:
        '200': { description: OK, content: { application/json: { schema: { $ref: '#/components/schemas/MCPPromptRender' } } } }
  /api/v1/mcp/resources:
    get:
      operationId: mcpGetMcpResources
      summary: List MCP resources(ontology)
      tags: [mcp]
      x-mate-owner: ai-protocols
      x-mate-permission: mcp.read
      x-mate-requirements: [FR-MCP-MCPGETMCPRESOURCES]
      x-mate-implementation-status: implemented
      responses:
        '200': { description: OK, content: { application/json: { schema: { type: array, items: { $ref: '#/components/schemas/MCPResource' } } } } }
  /api/v1/mcp/tools:
    get:
      operationId: mcpGetMcpTools
      summary: List MCP tools
      tags: [mcp]
      x-mate-owner: ai-protocols
      x-mate-permission: mcp.read
      x-mate-requirements: [FR-MCP-MCPGETMCPTOOLS]
      x-mate-implementation-status: implemented
      responses:
        '200': { description: OK, content: { application/json: { schema: { type: array, items: { $ref: '#/components/schemas/MCPTool' } } } } }
  /api/v1/mcp/tools/{name}:
    post:
      operationId: mcpPostMcpToolsName
      summary: Invoke MCP tool
      tags: [mcp]
      x-mate-owner: ai-protocols
      x-mate-permission: mcp.execute
      x-mate-requirements: [FR-MCP-MCPPOSTMCPTOOLSNAME]
      x-mate-implementation-status: implemented
      parameters: [ { name: name, in: path, required: true, schema: { type: string } } ]
      requestBody: { required: true, content: { application/json: { schema: { $ref: '#/components/schemas/MCPToolInvoke' } } } }
      responses:
        '200': { description: OK, content: { application/json: { schema: { $ref: '#/components/schemas/MCPToolResult' } } } }

  # 新增 7 federation endpoint(spec 补全)
  /api/v1/mcp/federation/servers:
    get:
      operationId: mcpGetMcpFederationServers
      summary: List federated MCP servers
      tags: [mcp, federation]
      x-mate-owner: ai-protocols
      x-mate-permission: mcp.read
      x-mate-requirements: [FR-MCP-FEDERATION-LIST]
      x-mate-implementation-status: implemented
      responses:
        '200': { description: OK, content: { application/json: { schema: { type: array, items: { $ref: '#/components/schemas/MCPFederationServer' } } } } }
    post:
      operationId: mcpPostMcpFederationServers
      summary: Register a federated MCP server
      tags: [mcp, federation]
      x-mate-owner: ai-protocols
      x-mate-permission: mcp.admin
      x-mate-requirements: [FR-MCP-FEDERATION-REGISTER]
      x-mate-implementation-status: implemented
      requestBody: { required: true, content: { application/json: { schema: { $ref: '#/components/schemas/MCPFederationServerCreate' } } } }
      responses:
        '201': { description: Created, content: { application/json: { schema: { $ref: '#/components/schemas/MCPFederationServer' } } } }
  /api/v1/mcp/federation/servers/{id}:
    parameters: [ { name: id, in: path, required: true, schema: { type: string } } ]
    get:
      operationId: mcpGetMcpFederationServersId
      summary: Get federated MCP server details
      tags: [mcp, federation]
      x-mate-owner: ai-protocols
      x-mate-permission: mcp.read
      x-mate-requirements: [FR-MCP-FEDERATION-GET]
      x-mate-implementation-status: implemented
      responses:
        '200': { description: OK, content: { application/json: { schema: { $ref: '#/components/schemas/MCPFederationServer' } } } }
    put:
      operationId: mcpPutMcpFederationServersId
      summary: Update federated MCP server
      tags: [mcp, federation]
      x-mate-owner: ai-protocols
      x-mate-permission: mcp.admin
      x-mate-requirements: [FR-MCP-FEDERATION-UPDATE]
      x-mate-implementation-status: implemented
      requestBody: { required: true, content: { application/json: { schema: { $ref: '#/components/schemas/MCPFederationServerUpdate' } } } }
      responses:
        '200': { description: OK }
    delete:
      operationId: mcpDeleteMcpFederationServersId
      summary: Deregister a federated MCP server
      tags: [mcp, federation]
      x-mate-owner: ai-protocols
      x-mate-permission: mcp.admin
      x-mate-requirements: [FR-MCP-FEDERATION-DELETE]
      x-mate-implementation-status: implemented
      responses:
        '204': { description: No Content }
  /api/v1/mcp/federation/tools:
    get:
      operationId: mcpGetMcpFederationTools
      summary: List tools from all federated servers(aggregate)
      tags: [mcp, federation]
      x-mate-owner: ai-protocols
      x-mate-permission: mcp.read
      x-mate-requirements: [FR-MCP-FEDERATION-TOOLS]
      x-mate-implementation-status: implemented
      parameters: [ { name: server_id, in: query, required: false, schema: { type: string } } ]
      responses:
        '200': { description: OK, content: { application/json: { schema: { type: array, items: { $ref: '#/components/schemas/MCPToolFederation' } } } } }
  /api/v1/mcp/federation/tools/{name}/invoke:
    post:
      operationId: mcpPostMcpFederationToolsNameInvoke
      summary: Invoke a federated MCP tool
      tags: [mcp, federation]
      x-mate-owner: ai-protocols
      x-mate-permission: mcp.execute
      x-mate-requirements: [FR-MCP-FEDERATION-INVOKE]
      x-mate-implementation-status: implemented
      parameters: [ { name: name, in: path, required: true, schema: { type: string } } ]
      requestBody: { required: true, content: { application/json: { schema: { $ref: '#/components/schemas/MCPToolInvoke' } } } }
      responses:
        '200': { description: OK, content: { application/json: { schema: { $ref: '#/components/schemas/MCPToolResult' } } } }

# components
components:
  schemas:
    MCPPrompt:
      type: object
      properties:
        name: { type: string }
        description: { type: string }
        arguments: { type: array, items: { $ref: '#/components/schemas/MCPArgument' } }
    MCPPromptRender:
      type: object
      properties:
        name: { type: string }
        content: { type: string }
    MCPArgument:
      type: object
      properties:
        name: { type: string }
        required: { type: boolean }
        description: { type: string }
    MCPResource:
      type: object
      properties:
        uri: { type: string }
        name: { type: string }
        type: { type: string, enum: [ontology, document, dataset, ...] }
    MCPTool:
      type: object
      properties:
        name: { type: string }
        description: { type: string }
        input_schema: { type: object }
    MCPToolInvoke:
      type: object
      properties:
        arguments: { type: object }
        context: { type: object }
    MCPToolResult:
      type: object
      properties:
        result: { type: object }
        metadata: { type: object }
    MCPFederationServer:
      type: object
      properties:
        id: { type: string }
        name: { type: string }
        endpoint: { type: string, format: uri }
        auth_type: { type: string, enum: [none, bearer, mTLS] }
        status: { type: string, enum: [active, inactive, error] }
        last_health_check_at: { type: string, format: date-time }
    MCPFederationServerCreate:
      type: object
      required: [name, endpoint]
      properties:
        name: { type: string }
        endpoint: { type: string, format: uri }
        auth_type: { type: string, enum: [none, bearer, mTLS] }
        auth_secret_ref: { type: string, description: SealedSecret ref }
    MCPFederationServerUpdate:
      type: object
      properties:
        endpoint: { type: string, format: uri }
        auth_type: { type: string, enum: [none, bearer, mTLS] }
        status: { type: string, enum: [active, inactive] }
    MCPToolFederation:
      type: object
      properties:
        name: { type: string }
        server_id: { type: string }
        server_name: { type: string }
        description: { type: string }
        input_schema: { type: object }
```

### 3.2 `security:` 段(三段式)

每个 endpoint 必须有:

```yaml
security:
  - bearerAuth: []
    tenantHeader: []
    oidcScopes: [platform.read]   # GET 用
    # 或 [platform.write]           # POST/PUT/DELETE 用
```

### 3.3 新增 REQ-ID

| FR-MCP-* ID | endpoint |
|---|---|
| FR-MCP-MCPGETMCPPROMPTS | GET /mcp/prompts |
| FR-MCP-MCPPOSTMCPPROMPTSNAME | POST /mcp/prompts/{name} |
| FR-MCP-MCPGETMCPRESOURCES | GET /mcp/resources |
| FR-MCP-MCPGETMCPTOOLS | GET /mcp/tools |
| FR-MCP-MCPPOSTMCPTOOLSNAME | POST /mcp/tools/{name} |
| FR-MCP-FEDERATION-LIST | GET /mcp/federation/servers |
| FR-MCP-FEDERATION-REGISTER | POST /mcp/federation/servers |
| FR-MCP-FEDERATION-GET | GET /mcp/federation/servers/{id} |
| FR-MCP-FEDERATION-UPDATE | PUT /mcp/federation/servers/{id} |
| FR-MCP-FEDERATION-DELETE | DELETE /mcp/federation/servers/{id} |
| FR-MCP-FEDERATION-TOOLS | GET /mcp/federation/tools |
| FR-MCP-FEDERATION-INVOKE | POST /mcp/federation/tools/{name}/invoke |

---

## 4. 验收标准(给 code 模式)

- `redocly bundle` 通过
- `spectral lint` 通过
- `oasdiff` 对比前后 spec,无未批准 breaking change
- 全后端回归 `pytest packages/` 通过
- SPEC 命中:**209/214 → 214/214**(5 个原 endpoint + 7 个新增 federation)
- `docs/active/specs/2026-07-27-mate-platform-delivery-roadmap.md` §3 当前快照 同步刷新

---

## 5. 后续 PR 计划

```
PR #N (P3-W10):
  - 修改: contracts/openapi/services/mcp.yaml(+ 7 federation endpoint)
  - 修改: mate-tech-mcp 包 main.py(挂 5 原 endpoint 的 router)
  - 测试: pytest mate-tech-mcp/tests ≥ 7 + 7 cases
  - 验收: docs/active/delivery/evidence/P3-W10-MCP-ACCEPTANCE.md
```

---

## 6. 关联文档

- `PRD-APP-MCPHUB-MCP服务中心_v2.2-20260727.md` — 业务方需求
- `PRD-TECH-MCP` (历史) — 技术能力
- `ADR-0014-tech-services-integration.md` — 集成模式
- `contracts/openapi/services/mcp.yaml` — spec 源(本修订)
- `packages/mate-tech-mcp/src/mate_tech_mcp/main.py` — code 源(本修订)

---

## 7. 变更记录

| 日期 | 变更 | 作者 |
|---|---|---|
| 2026-08-01 | v1.0 初版(5 原 endpoint 落地指引 + 7 federation endpoint spec 补全) | 需求层(TRAE) |