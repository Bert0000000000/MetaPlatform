# TECH-LLMGW - LLM Gateway 服务

> v1.3 角色：Java 25 + Spring Boot 3.5 + Spring AI Alibaba 1.1.2.2
> 全部代码 Java（README 早期提到的 Python + FastAPI 已废弃）。

## 关键能力

- 多模型路由（DASH_SCOPE / OPENAI / ANTHROPIC / LOCAL_VLLM）
- **OpenAI 兼容协议**（P0.3.2）：`/v1/chat/completions` `/v1/models` `/v1/embeddings`
- 限流（Redis 滑动窗口，P0.3.4）
- 审计 + Token 配额 + 成本核算（P0.3.5）

## 为 DeerFlow 提供 OpenAI 兼容调用

DeerFlow Adapter 配置：

```yaml
llm:
  base_url: https://llmgw.metaplatform.local/v1
  api_key: ${MATE_LLMGW_API_KEY}
  model: gpt-4o       # 自动映射到 qwen-max
```

调用：

```text
POST /v1/chat/completions
Authorization: Bearer ${MATE_LLMGW_API_KEY}
X-Tenant-Id: TENANT-01
X-User-Id: USER-1001
Content-Type: application/json

{
  "model": "gpt-4o",
  "messages": [{"role": "user", "content": "分析华东区销售下降原因"}],
  "stream": false,
  "user": "USER-1001"
}
```

返回标准 OpenAI 协议响应（`id / object / choices / usage`）。

## 模型路由（ModelRouter）

OpenAI 名 → 平台内部名映射示例：

| OpenAI | 平台 |
|---|---|
| gpt-4o | qwen-max |
| gpt-4-turbo | qwen-max-longcontext |
| gpt-3.5-turbo | qwen-turbo |
| o1 / o1-mini | qwen-max-thinking / qwen-plus-thinking |
| claude-3.5-sonnet | qwen-max |
| doubao-pro | doubao-pro |
| deepseek-chat | deepseek-chat |
| text-embedding-3-* | text-embedding-v3 |

未识别模型 → fallback 到 `qwen-max`。

## 限流

- 默认 60 RPM / 租户 / 模型
- Redis 滑动窗口：键 `llmgw:rl:{tenantId}:{model}:{epochMinute}`，TTL 70s
- 超限返回 HTTP 429 + OpenAI Error body

## 审计（P0.3.5）

所有 `/v1/chat/completions` 调用记录到 `audit_log` 表（已存在），含：

- tenantId / userId / agentId
- requested model / resolved model
- prompt tokens / completion tokens / cost
- traceId（与 `TECH-OBS` 关联）

## 端口

```
HTTP: 8210
Nacos Service Name: tech-llmgw-server
```

## 目录

```
TECH-LLMGW/
├── pom.xml
├── README.md
├── src/main/java/com/metaplatform/llmgw/
│   ├── audit/          # 审计
│   ├── chat/           # 平台 chat 接口（已有）
│   ├── code/           # 代码生成（已有）
│   ├── cost/           # 成本核算
│   ├── embeddings/     # 向量
│   ├── functions/      # Function Calling
│   ├── models/         # 模型注册
│   ├── openai/         # ★ P0.3.2 OpenAI 兼容层
│   │   ├── OpenAiController.java
│   │   ├── OpenAiDtos.java
│   │   └── OpenAiRateLimitFilter.java
│   ├── prompts/        # Prompt 模板
│   ├── quotas/         # Token 配额
│   ├── ratelimits/     # ★ P0.3.4 限流
│   ├── routing/        # 路由（已有）
│   └── router/         # ★ P0.3.3 模型路由
└── src/main/resources/
    └── application.yml
```
