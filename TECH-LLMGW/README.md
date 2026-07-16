# TECH-LLMGW - LLM Gateway 服务

## 模块类型

TECH 模块

## 作用

大模型统一接入网关，支持多模型路由、限流熔断、Fallback、成本核算、Prompt/Response 审计。**所有 LLM 调用必须通过 TECH-LLMGW，不直接访问模型 API**。

## 上游依赖

- `TECH-IAM`：用户认证、租户隔离、API Key 权限校验

## 下游消费

- `TECH-RAG`
- `TECH-AGENT`
- `APP-SUPERAI`
- `APP-DW`
- `APP-APPHUB`
- `APP-MCPHUB`
- `APP-DASHBOARD`

## 技术栈

| 层级 | 技术 | 版本 | 用途 |
|---|---|---|---|
| 语言/框架 | Python + FastAPI | 3.13 / 0.115+ | 服务主体 |
| 验证 | Pydantic | v2 | Schema 与配置 |
| 关系数据库 | PostgreSQL | 17 | 元数据 & 调用日志（Phase 3+） |
| 缓存 | Redis | 7.4 | 限流/配额/缓存（Phase 3+） |
| 消息队列 | Kafka | 3.9 | 事件发布（Phase 3+，Outbox 模式） |
| 链路追踪 | OpenTelemetry | 1.45+ | trace_id 传播 |

## 端口

```
HTTP: 8401
```

## 目录结构

```
TECH-LLMGW/
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── chat.py            # 多模态对话
│   │       ├── embeddings.py      # 批量向量化
│   │       ├── models.py          # 模型管理
│   │       └── router.py          # v1 聚合
│   ├── chat/                      # 多模态对话领域
│   │   ├── provider_client.py
│   │   ├── schemas.py
│   │   └── service.py
│   ├── common/                    # 公共工具
│   │   ├── api_response.py
│   │   ├── context.py
│   │   ├── errors.py
│   │   └── middleware.py
│   ├── embeddings/                # 向量化领域
│   │   ├── client.py
│   │   ├── schemas.py
│   │   └── service.py
│   ├── models/                    # 模型领域
│   │   ├── catalog.py
│   │   ├── repository.py
│   │   ├── schemas.py
│   │   └── service.py
│   ├── config.py
│   └── deps.py                    # 服务注册表 & 依赖注入
├── docs/                          # 模块文档
│   ├── SPEC-TECH-LLMGW-LLM网关API规范_v1.0-20260716.md       # 全量规范
│   └── SPEC-TECH-LLMGW-LLM网关服务规范_v1.0-20260716.md       # Phase 2 服务规范
├── tests/                         # 测试目录
│   ├── conftest.py
│   ├── test_chat_service.py
│   ├── test_context.py
│   ├── test_controllers.py
│   ├── test_embedding_service.py
│   └── test_model_service.py
├── main.py
├── pyproject.toml
└── README.md
```

---

## Phase 2 增量能力（P1-LLMGW-01/02/03）

Phase 2 在 Phase 1（供应商 CRUD 骨架）基础上落地三组能力：

### 1. 模型管理 API（P1-LLMGW-01）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/llmgw/models/sync` | 同步供应商可用模型（基于 `ModelCatalog` 常量表） |
| GET | `/api/v1/llmgw/models` | 列出已同步模型，支持 `provider`/`type`/`enabled` 过滤与分页 |
| GET | `/api/v1/llmgw/models/multimodal` | 多模态模型子集 |
| GET | `/api/v1/llmgw/models/embedding` | Embedding 模型子集 |
| GET | `/api/v1/llmgw/models/{id}` | 模型详情 |
| GET | `/api/v1/llmgw/models/global` | 跨租户聚合视图（自身 + 公共） |

**核心模型字段**（对应 `llm_models` 表）：

```
model_id / tenant_id / provider / model_code / display_name
type (CHAT/EMBEDDING/MULTIMODAL) / input_price / output_price
context_length / capabilities (JSONB) / enabled / description
created_at / updated_at
```

模型元数据由 `app/models/catalog.py` 中的 `ModelCatalog` 常量表维护，避免在 Phase 2 真实调用供应商 API（节省 token & 适配离线/测试）。

### 2. 多模态对话 API（P1-LLMGW-02）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/llmgw/chat/multimodal` | 文本 + 图片（base64 或 URL）内联调用 |
| POST | `/api/v1/llmgw/chat/multimodal/upload` | multipart 文件上传调用 |

请求体关键字段：`modelId` / `text` / `images[]`（url 或 base64）/ `temperature` / `maxTokens` / `systemPrompt`。

返回 `ApiResponse<{id, model, provider, content, usage, latencyMs}>`。

### 3. 批量向量化 API（P1-LLMGW-03）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/llmgw/embeddings/batch` | 批量 Embedding（1-100 条，可选 L2 归一化） |

请求：`{modelId, inputs[], normalize}`。
返回：`{model, provider, dimension, embeddings, usage}`。

---

## 通用约定

- **路径前缀**：`/api/v1/llmgw`
- **统一响应**：`{code, message, data, traceId}`（`code=0` 成功）
- **租户隔离**：`X-Tenant-Id` 必填；或从 `Authorization: Bearer <jwt>` 解 `tenantId` claim；测试态默认 `tenant-default`
- **trace_id**：`X-Trace-Id` 透传，否则服务端生成 UUID v4
- **错误码**：见 `SPEC-TECH-LLMGW-LLM网关服务规范_v1.0-20260716.md` §2.4
- **端口**：`8401`

---

## 快速开始

### 本地运行

```bash
# 创建虚拟环境
python -m venv .venv
.venv\Scripts\activate   # Windows
# source .venv/bin/activate   # Linux/macOS

# 安装依赖
pip install fastapi uvicorn[standard] pydantic-settings httpx pytest python-multipart

# 启动服务
python main.py
# -> http://localhost:8401/docs
```

### 运行测试

```bash
# 全部测试
pytest

# 仅控制器层
pytest tests/test_controllers.py

# 仅某个测试
pytest tests/test_model_service.py::TestModelServiceSync::test_sync_models_success
```

### 示例调用

```bash
# 1. 同步模型目录
curl -X POST http://localhost:8401/api/v1/llmgw/models/sync \
  -H "X-Tenant-Id: tenant-001" \
  -H "Content-Type: application/json" \
  -d '{"providers":["OPENAI","VOLCENGINE"]}'

# 2. 列出多模态模型
curl http://localhost:8401/api/v1/llmgw/models/multimodal \
  -H "X-Tenant-Id: tenant-001"

# 3. 多模态对话
curl -X POST http://localhost:8401/api/v1/llmgw/chat/multimodal \
  -H "X-Tenant-Id: tenant-001" \
  -H "Content-Type: application/json" \
  -d '{
    "modelId": "m-openai-gpt-4o",
    "text": "请描述这张图片",
    "images": [{"url": "https://example.com/cat.png", "detail": "high"}],
    "temperature": 0.3,
    "maxTokens": 1024
  }'

# 4. 批量向量化
curl -X POST http://localhost:8401/api/v1/llmgw/embeddings/batch \
  -H "X-Tenant-Id: tenant-001" \
  -H "Content-Type: application/json" \
  -d '{
    "modelId": "m-volcengine-doubao-embedding-large",
    "inputs": ["hello", "world"],
    "normalize": true
  }'
```

---

## 架构说明

### Mock Provider / Embedding 客户端

Phase 2 不发起真实网络请求；`app/chat/provider_client.py` 的 `MockProviderClient` 与 `app/embeddings/client.py` 的 `MockEmbeddingClient` 均通过 SHA-256 摘要派生出**确定性**的响应/向量，便于：

1. 测试不消耗 token
2. 单元测试可断言稳定输出
3. Phase 3 接入真实 SDK 时仅替换实现类

### Provider / Embedding 抽象

`ProviderClient` / `EmbeddingClient` 是 `Protocol` 接口；Phase 3 接入火山方舟、OpenAI、Anthropic SDK 时，新增实现类并在 `app/deps.py` 的 `Registry` 中替换即可，控制器/服务层零改动。

### 租户隔离

- `ModelRepository` 的 key 为 `(tenant_id, provider, code)`
- `list(tenant_id, ...)` 严格按 `tenant_id` 过滤
- `list_global(tenant_id, ...)` 返回 `tenant_id ∈ {tenant_id, "_public"}`
- 公共租户 `_public` 由 `sync` 自动维护（`/models/global` 可访问）

### 错误流

所有业务异常继承 `BizException`，由 `app/common/middleware.py` 中的全局 handler 统一包装为 `ApiResponse`，并设置对应 HTTP 状态码（`BizException.http_status` / `ERROR_HTTP_STATUS` 映射）。

---

## 相关文档

- [项目总览](../../README.md)
- [全量 API 规范](./docs/SPEC-TECH-LLMGW-LLM网关API规范_v1.0-20260716.md)
- [Phase 2 服务规范](./docs/SPEC-TECH-LLMGW-LLM网关服务规范_v1.0-20260716.md)
- [架构设计](../../docs/001-ARCH/)
- [技术选型](../../docs/002-TS/)
- [规范文档](../../docs/003-SPEC/)
- [版本路线图](../../docs/004-PLAN/PLAN-Mate_Platform-版本路线图_v2.0-20260716.md)