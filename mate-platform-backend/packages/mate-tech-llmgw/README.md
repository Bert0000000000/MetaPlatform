# mate-tech-llmgw

Mate Platform LLM Gateway（自研；借鉴 LiteLLM 设计，不引入其组件——决策见 2026-09-09 评估）。

## 能力总览（P0–P6 收口，2026-09-09）

- **多 provider 路由**：openai / anthropic / doubao(ARK) / qwen / deepseek / moonshot / local(dev)
- **韧性**：provider 冷却熔断（失败/分钟 → allowed_fails → Redis 冷却；时长：配置 > Retry-After > 默认 60s）+ 有界重试（仅 5xx/408/429/网络错误，2 次、0.5s→2s 退避）+ env fallback 链；4xx 客户端错误直接透传不重试
- **限流**：Lua 原子固定分钟窗口（RPM+TPM），per-tenant 配置（`llmgw_tenant_config` 表 → Redis 读穿缓存 300s）
- **成本计量（三层）**：`llm_usage` 每请求明细 → `llm_usage_daily` 日聚合（预算判定只读此层）→ `llmgw_api_keys.spend_usd` 行级累计；vendored 价格库（LiteLLM MIT 数据子集 + arkcli 核实的 ARK 价）
- **预算语义**：soft_budget 告警一次（OTel counter）/ max_budget 429；月度 token 上限；用户日费用帽
- **缓存**：Redis 响应缓存（命中按 cache_read 价计量）
- **Virtual Key（P5）**：`sk-llmgw-*` 消费方 key——签发/吊销/轮换管理端点 + per-key 模型白名单 / rpm+tpm / 预算窗口；DB 只存 sha256
- **租户安全**：业务端点 tenant 以 JWT ctx 为准（body 缺省回填 / 不一致 403）；管理端点同租户校验

## 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `REDIS_URL` / `PG_DSN` | — | 软依赖；缺失自动降级不阻断。llmgw 表建在 PG_DSN 库（metaplatform_kb） |
| `MATE_LLMGW_ENABLE_REDIS_QUOTA` | profile 判定 | 租户限流开关 |
| `MATE_LLMGW_ENABLE_CACHE` / `_COST_PG` / `_MONTHLY_CEILING` / `_USER_DAILY_CAP` | true | 各子系统独立开关（单变量回滚） |
| `MATE_LLMGW_ENABLE_COOLDOWN` | true | provider 冷却熔断 |
| `MATE_LLMGW_ENABLE_KEYS` | true | virtual key 认证与管理端点 |
| `LLMGW_FALLBACKS` | `{}` | JSON `{model: [fallback models]}` |
| `LLMGW_COOLDOWN_ALLOWED_FAILS` / `LLMGW_COOLDOWN_SECONDS` | 2 / 60 | 冷却阈值与默认时长 |
| `LLMGW_MODEL_ALIASES` | `{}` | JSON 模型名映射（**ARK ep-xxx 接入点 ID 的唯一登记处**） |
| `LLMGW_PRICE_OVERRIDES` | `{}` | JSON 单价覆盖（协议价） |
| `SERVICE_CLIENT_SECRET` | — | 服务身份 secret（生产必须注入，硬规则 12） |

## 运维

```bash
# 建表（幂等；启动时也会自动执行）
python -m mate_tech_llmgw.schema            # 按 PG_DSN
python -m mate_tech_llmgw.schema --print    # 只打印 DDL
python -m mate_tech_llmgw.schema --downgrade  # 打印回滚 SQL

# 管理 virtual keys（需 JWT，同租户校验）
POST   /api/v1/llmgw/keys            # 签发（明文只出现一次）
GET    /api/v1/llmgw/keys            # 列表（永不含明文）
DELETE /api/v1/llmgw/keys/{id}       # 吊销（缓存即失效）
POST   /api/v1/llmgw/keys/{id}/rotate
GET    /api/v1/llmgw/keys/{id}/info  # 详情 + 窗口用量
```

llmgw 的表归 llmgw 管（`repositories/ddl.py` 单一事实源），**不进平台 alembic 链**。

## 价格库维护

见 `src/mate_tech_llmgw/cost/data/README.md`（来源、拉取日期、更新流程）。doubao 段每季度用 `arkcli pricing` 复核。

## 已知边界 / Follow-up

- `api/routes.py` 仍为单文件（schemas/deps 已具备抽取边界；物理拆分因 `patch("...api.routes.router_chat")` 测试耦合留待后续）
- `llmgw_providers/models/route_rules` 三张 DB 路由表运行时仍未激活（硬编码路由表在 `router.py`）
- copilot `llm/factory.py` 的 OPENAI/ANTHROPIC 直连分支仍在（compose 未配 key，生产路径走 llmgw）
