# SPEC - LLM Gateway 服务规范（TECH-LLMGW · Phase 2）

> 文档版本：v1.0
> 文档日期：2026-07-16
> 适用模块：TECH-LLMGW（LLM Gateway Service）
> 适用阶段：Phase 2（P1-LLMGW-01 / 02 / 03）
> 维护方：Mate Platform 平台架构组
> 状态：定稿

---

## 版本历史

| 版本 | 日期 | 变更说明 | 作者 |
|---|---|---|---|
| v1.0 | 2026-07-16 | Phase 2 定稿：模型管理、多模态对话、批量向量化 | Mate Platform 架构组 |

---

## 1. 阶段概述

### 1.1 范围

Phase 2 在 Phase 1（供应商 CRUD + 模型路由骨架）基础上，落地以下三组能力：

- **P1-LLMGW-01 模型管理 API**：模型目录同步、模型列表/详情/全局视图。
- **P1-LLMGW-02 多模态对话 API**：文本 + 图片（base64 或 URL）对话、上传模式与内联模式。
- **P1-LLMGW-03 批量向量化 API**：批量 Embedding + 可选归一化。

### 1.2 与 Phase 1 / 全量规范的关系

- 通用约定（路径前缀、统一响应体、错误码、trace_id 传播、租户隔离、幂等、SSE、加密 API Key）沿用 [`SPEC-TECH-LLMGW-LLM网关API规范_v1.0-20260716.md`](./SPEC-TECH-LLMGW-LLM网关API规范_v1.0-20260716.md)（全量规范）。
- 本文档仅描述 Phase 2 增量端点与数据模型；如有冲突，以全量规范为准。

### 1.3 技术栈

- Python 3.13+ / FastAPI 0.115+
- Pydantic v2 / pydantic-settings
- 内存模型目录 + Provider 抽象层（便于测试时 mock）

---

## 2. Phase 2 通用约定

### 2.1 路径前缀

```
/api/v1/llmgw
```

### 2.2 统一响应体

```json
{
  "code": 0,
  "message": "success",
  "data": { },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

- `code = 0` 表示成功；非 0 表示业务错误。
- `traceId` 入站优先取 `X-Trace-Id`，否则由中间件生成 UUID v4。
- 列表类接口使用 `data = { items, total, page, pageSize, totalPages }`。

### 2.3 租户隔离

- 所有写操作与列表查询必须基于 `tenantId` 隔离；`tenantId` 从 `X-Tenant-Id` 请求头或 Bearer JWT 的 `tenantId` claim 取值。
- 模型目录同步动作仅影响当前租户；`GET /models/global` 聚合自身 + 系统公共（`tenantId = "_public"`）模型。

### 2.4 错误码（Phase 2 增量）

| 错误码 | HTTP 状态 | 标识 | 场景 |
|---|---|---|---|
| 40001 | 400 | INVALID_PARAM | 请求参数校验失败 |
| 40003 | 400 | MISSING_REQUIRED_FIELD | 缺字段 |
| 40004 | 400 | INVALID_FIELD_VALUE | 字段值非法 |
| 40005 | 400 | UNSUPPORTED_MODEL_TYPE | 模型类型不支持当前端点 |
| 40006 | 400 | UNSUPPORTED_MODALITY | 模型不支持多模态/输入模态 |
| 40302 | 403 | TENANT_MISMATCH | 跨租户访问被拒绝 |
| 40401 | 404 | PROVIDER_NOT_FOUND | 供应商不存在 |
| 40402 | 404 | MODEL_NOT_FOUND | 模型不存在 |
| 42202 | 422 | MODEL_NOT_AVAILABLE | 模型未启用 |
| 42203 | 422 | ALL_PROVIDERS_FAILED | 调用失败 |
| 50001 | 500 | INTERNAL_ERROR | 内部错误 |
| 50005 | 500 | PROVIDER_API_ERROR | 供应商 API 错误 |

> 全量错误码见全量规范 §2.5。Phase 2 接口的 `data` 字段可携带结构化错误信息（如 `provider/modelId/traceback`），便于排查。

---

## 3. 模型管理 API（P1-LLMGW-01）

### 3.1 接口总览

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/llmgw/models/sync` | 从已配置的供应商同步可用模型 |
| GET | `/api/v1/llmgw/models` | 列出当前租户已同步的模型 |
| GET | `/api/v1/llmgw/models/multimodal` | 仅多模态（图片输入）模型 |
| GET | `/api/v1/llmgw/models/embedding` | 仅 Embedding 模型 |
| GET | `/api/v1/llmgw/models/{id}` | 模型详情 |
| GET | `/api/v1/llmgw/models/global` | 跨租户聚合：当前租户 + 公共模型 |

### 3.2 数据库表 `llm_models`

Phase 2 引入 `llm_models` 表（in-memory 模拟存储），DDL 思路：

```sql
CREATE TABLE llm_models (
    model_id          VARCHAR(128) PRIMARY KEY,
    tenant_id         VARCHAR(64)  NOT NULL,
    provider          VARCHAR(32)  NOT NULL,        -- OPENAI / ANTHROPIC / VOLCENGINE / QWEN / ...
    model_code        VARCHAR(128) NOT NULL,        -- 供应商侧模型标识
    display_name      VARCHAR(256) NOT NULL,
    type              VARCHAR(16)  NOT NULL,        -- CHAT / EMBEDDING / MULTIMODAL
    input_price       NUMERIC(12,6) NOT NULL DEFAULT 0,   -- 元/千 token
    output_price      NUMERIC(12,6) NOT NULL DEFAULT 0,
    context_length    INTEGER      NOT NULL DEFAULT 0,
    capabilities      JSONB        NOT NULL DEFAULT '[]'::jsonb,
    enabled           BOOLEAN      NOT NULL DEFAULT TRUE,
    description       TEXT,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, provider, model_code)
);
```

> Phase 2 在内存中模拟该表；Phase 3+ 接入真实 PostgreSQL 时保持列结构兼容。

### 3.3 `ModelCatalog` 常量

为避免在 Phase 2 真实调用供应商 API，模型价格/上下文长度/能力由 `ModelCatalog` 常量表维护：

```python
# 简化示意
ModelCatalog.CATALOG = [
    ModelSpec(provider="OPENAI",       code="gpt-4o",          type="MULTIMODAL", context=128000, in=0.005,  out=0.015, caps=["CHAT","VISION","FUNCTION_CALLING"]),
    ModelSpec(provider="OPENAI",       code="gpt-4o-mini",     type="MULTIMODAL", context=128000, in=0.00015,out=0.0006,caps=["CHAT","VISION","FUNCTION_CALLING"]),
    ModelSpec(provider="OPENAI",       code="text-embedding-3-large", type="EMBEDDING", context=8191, in=0.00013,out=0.0, caps=["EMBEDDING"]),
    ModelSpec(provider="ANTHROPIC",    code="claude-3-5-sonnet",type="MULTIMODAL", context=200000,in=0.003,  out=0.015, caps=["CHAT","VISION","FUNCTION_CALLING"]),
    ModelSpec(provider="VOLCENGINE",   code="doubao-pro-32k",  type="CHAT",       context=32768, in=0.008,  out=0.024, caps=["CHAT","FUNCTION_CALLING"]),
    ModelSpec(provider="VOLCENGINE",   code="doubao-vision-pro", type="MULTIMODAL",context=32768, in=0.012,  out=0.036, caps=["CHAT","VISION"]),
    ModelSpec(provider="VOLCENGINE",   code="doubao-embedding-large",type="EMBEDDING",context=8192,in=0.0005, out=0.0,  caps=["EMBEDDING"]),
    ModelSpec(provider="QWEN",         code="qwen-vl-max",     type="MULTIMODAL", context=32000, in=0.02,   out=0.06,  caps=["CHAT","VISION"]),
    ModelSpec(provider="QWEN",         code="text-embedding-v3",type="EMBEDDING", context=8192, in=0.0007, out=0.0,   caps=["EMBEDDING"]),
]
```

### 3.4 同步模型列表

**POST** `/api/v1/llmgw/models/sync`

从当前租户启用的供应商拉取可用模型目录（Phase 2 通过 `ProviderClient` 抽象；默认 `MockProviderClient` 直接返回 `ModelCatalog` 过滤后的数据）。

请求体（可选）：

```json
{
  "providers": ["OPENAI", "VOLCENGINE"]
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| providers | array[string] | 否 | 仅同步指定供应商；为空则同步当前租户全部 ACTIVE 供应商 |

响应：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "syncedAt": "2026-07-16T14:00:00.000+08:00",
    "providers": [
      { "provider": "OPENAI", "fetched": 3, "added": 0, "updated": 3, "removed": 0 },
      { "provider": "VOLCENGINE", "fetched": 3, "added": 1, "updated": 2, "removed": 0 }
    ],
    "total": 6
  },
  "traceId": "..."
}
```

错误场景：

- `40401` 传入的 provider 不存在。
- `50005` 供应商 API 错误（mock 测试时由 `MockProviderClient` 模拟）。

### 3.5 模型列表

**GET** `/api/v1/llmgw/models`

Query 参数：

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| provider | string | 否 | - | 供应商过滤 |
| type | string | 否 | - | 模型类型：`CHAT` / `EMBEDDING` / `MULTIMODAL` |
| enabled | boolean | 否 | true | 是否启用 |
| page | integer | 否 | 1 | 页码 |
| pageSize | integer | 否 | 20 | 1-100 |

响应：`data.items[]` 结构：

```json
{
  "modelId": "m-openai-gpt-4o",
  "tenantId": "tenant-001",
  "provider": "OPENAI",
  "modelCode": "gpt-4o",
  "displayName": "GPT-4o",
  "type": "MULTIMODAL",
  "inputPrice": 0.005,
  "outputPrice": 0.015,
  "contextLength": 128000,
  "capabilities": ["CHAT", "VISION", "FUNCTION_CALLING"],
  "enabled": true,
  "description": "OpenAI 多模态旗舰模型",
  "createdAt": "2026-07-16T14:00:00.000+08:00",
  "updatedAt": "2026-07-16T14:00:00.000+08:00"
}
```

### 3.6 模型详情

**GET** `/api/v1/llmgw/models/{id}`

响应同 3.5 元素结构；错误 `40402`。

### 3.7 全局模型视图

**GET** `/api/v1/llmgw/models/global`

返回当前租户 + `tenantId = "_public"` 公共模型；不分页（一次返回）。支持 `type` 过滤。

### 3.8 多模态 / Embedding 子集

- `GET /api/v1/llmgw/models/multimodal`：`type = MULTIMODAL` 且 `capabilities ⊇ {"VISION"}`。
- `GET /api/v1/llmgw/models/embedding`：`type = EMBEDDING` 且 `enabled = true`。

---

## 4. 多模态对话 API（P1-LLMGW-02）

### 4.1 接口总览

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/llmgw/chat/multimodal` | 内联图片（base64 或 URL）调用 |
| POST | `/api/v1/llmgw/chat/multimodal/upload` | multipart 文件上传 + 文本 |

### 4.2 内联调用

**POST** `/api/v1/llmgw/chat/multimodal`

请求体：

```json
{
  "modelId": "m-openai-gpt-4o",
  "text": "请描述这张图片",
  "images": [
    { "url": "https://example.com/cat.png", "detail": "high" },
    { "base64": "data:image/png;base64,iVBORw0...", "detail": "auto" }
  ],
  "temperature": 0.3,
  "maxTokens": 1024,
  "systemPrompt": "你是图像理解助手"
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| modelId | string | 是 | 多模态模型 ID（必须 `type = MULTIMODAL` 且支持 `VISION`） |
| text | string | 是 | 用户文本，长度 1-8192 |
| images | array | 是 | 至少 1 张，至多 8 张 |
| images[].url | string | 否 | 与 `base64` 二选一 |
| images[].base64 | string | 否 | 与 `url` 二选一；可带 `data:image/...;base64,` 前缀 |
| images[].detail | string | 否 | `low` / `high` / `auto`，默认 `auto` |
| temperature | float | 否 | 0.0-2.0，默认 0.7 |
| maxTokens | integer | 否 | 1-8192，默认 1024 |
| systemPrompt | string | 否 | 可选 system message |

响应 `data`：

```json
{
  "id": "chatcmpl-mm-001",
  "model": "gpt-4o",
  "provider": "OPENAI",
  "content": "图中有两只猫...",
  "finishReason": "stop",
  "usage": { "promptTokens": 1240, "completionTokens": 86, "totalTokens": 1326 },
  "latencyMs": 1820
}
```

### 4.3 上传调用

**POST** `/api/v1/llmgw/chat/multimodal/upload`

`multipart/form-data` 字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| modelId | string | 是 | 模型 ID |
| text | string | 是 | 文本提示 |
| image | file[] | 是 | 至少 1 张，至多 8 张；支持 `image/png`、`image/jpeg`、`image/webp` |
| temperature | float | 否 | - |
| maxTokens | integer | 否 | - |

服务端将上传文件读取后转 base64 内嵌到 `images[]`，再走 4.2 同一调用路径；返回体相同。

### 4.4 错误场景

| 错误码 | 场景 |
|---|---|
| 40001 | 缺 `modelId`/`text`/`images`；图片数 0 或 > 8 |
| 40006 | `modelId` 不是 MULTIMODAL 模型 |
| 40402 | modelId 不存在 |
| 42202 | 模型未启用 |
| 42203 | 调用失败 |
| 50005 | 供应商 API 错误 |

---

## 5. 批量向量化 API（P1-LLMGW-03）

### 5.1 接口总览

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/llmgw/embeddings/batch` | 批量 Embedding |

### 5.2 批量调用

**POST** `/api/v1/llmgw/embeddings/batch`

请求体：

```json
{
  "modelId": "m-volcengine-doubao-embedding-large",
  "inputs": ["文本1", "文本2", "文本3"],
  "normalize": true
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| modelId | string | 是 | Embedding 模型 ID（`type = EMBEDDING`） |
| inputs | array[string] | 是 | 1-100 条文本；单条 1-8192 字符 |
| normalize | boolean | 否 | 是否 L2 归一化，默认 false |

响应 `data`：

```json
{
  "model": "doubao-embedding-large",
  "provider": "VOLCENGINE",
  "dimension": 2048,
  "embeddings": [
    [0.012, -0.034, "..."],
    [0.045,  0.067, "..."],
    [0.078, -0.091, "..."]
  ],
  "usage": { "promptTokens": 96, "totalTokens": 96 }
}
```

### 5.3 错误场景

| 错误码 | 场景 |
|---|---|
| 40001 | 缺 `modelId`/`inputs`；`inputs` 为空或 > 100 |
| 40004 | 单条文本超长 |
| 40005 | `modelId` 不是 EMBEDDING 类型 |
| 40402 | modelId 不存在 |
| 42202 | 模型未启用 |
| 42203 | 调用失败 |

---

## 6. 数据流与组件

```
HTTP Request
    │
    ▼
FastAPI Middleware (trace_id, tenantId, error envelope)
    │
    ▼
Controller ── Pydantic schema validation
    │
    ▼
Service ── ModelRepository / ProviderClient / EmbeddingClient
    │
    ▼
(Mock ProviderClient / Mock EmbeddingClient in test)
    │
    ▼
ApiResponse{T} JSON 序列化
```

### 6.1 ProviderClient 抽象

```python
class ProviderClient(Protocol):
    def list_models(self, provider: str, tenant_id: str) -> list[ProviderModelDescriptor]: ...
    def chat_multimodal(self, provider: str, model_code: str, request: MultimodalRequest) -> MultimodalResponse: ...
```

Phase 2 提供 `MockProviderClient`，所有外部调用都通过该抽象，未来接入真实 SDK 时仅替换实现。

### 6.2 EmbeddingClient 抽象

```python
class EmbeddingClient(Protocol):
    def embed(self, provider: str, model_code: str, inputs: list[str]) -> list[list[float]]: ...
```

Phase 2 提供 `MockEmbeddingClient`（基于 hash 复现为伪随机但确定的向量），便于测试可复现。

---

## 7. 测试覆盖（至少 12 个用例）

| # | 用例 | 类型 |
|---|---|---|
| 1 | `test_sync_models_success` | Service + Controller |
| 2 | `test_sync_models_filters_inactive_provider` | Service |
| 3 | `test_list_models_filters_by_provider_type_enabled` | Service + Controller |
| 4 | `test_get_model_detail_404_when_missing` | Controller |
| 5 | `test_global_models_includes_public_and_tenant` | Service |
| 6 | `test_multimodal_requires_vision_capability` | Service |
| 7 | `test_multimodal_chat_success_with_url_image` | Controller + Service |
| 8 | `test_multimodal_chat_success_with_base64_image` | Controller |
| 9 | `test_multimodal_upload_endpoint_accepts_files` | Controller (multipart) |
| 10 | `test_embedding_batch_normalizes_vectors` | Service |
| 11 | `test_embedding_batch_rejects_non_embedding_model` | Service |
| 12 | `test_embedding_batch_input_too_many` | Service |
| 13 | `test_tenant_isolation_blocks_cross_tenant_model` | Service |
| 14 | `test_api_response_envelope_on_error` | Controller |

测试基于 `pytest` + FastAPI `TestClient`，所有外部调用通过 `MockProviderClient` / `MockEmbeddingClient` 注入，不发起真实 HTTP。

---

## 8. 安全与限制

- 所有写操作要求 `X-Tenant-Id`；缺省返回 `40003`。
- 模型 ID 形如 `m-{provider}-{code}`，服务端校验 provider 已知。
- Phase 2 仅在内存中保存模型目录；不持久化调用日志；`X-Trace-Id` 透传。
- 多模态接口对单张图片 base64 长度限制为 5MB（10MB base64）；服务端拒绝超大请求。

---

## 9. 后续阶段衔接

- Phase 3 引入 `llmgw_providers` 真实表 + 加密 API Key 存储。
- Phase 3 引入 `llmgw_call_logs` 表 + Outbox 事件发布。
- Phase 4 引入成本核算与限流；本次新增的 `usage` 字段已为 Phase 4 预留。