# PRD - APP-DW-业务RAG知识库Agent

> **版本**: v1.1 | **日期**: 2026-07-27
>
> **vv1.0 → vv1.1 主要变更**：
> 1. 与主 PRD 同步更新
> 2. API 接口按 Q2=B 归属 MATE-AGENT + TECH-RAG
> 3. 新增「待补交互清单」
> 4. 关联文档：`API-CONTRACT-前端接口契约清单_v1.0-20260727.md`、`PLAN-前后端并行开发接口边界_v1.0-20260727.md`

---


> **版本**: v1.0 | **日期**: 2026-07-22 | **关联主 PRD**: [`PRD-APP-DW-数字员工_v2.3-20260722.md`](./PRD-APP-DW-数字员工_v2.3-20260722.md) | **状态**: 正式版候选
>
> 本文件是 APP-DW 的**子文件**，专门描述业务 RAG 知识库数字员工（agentType=`BUSINESS_RAG_KB`），即 COPILOT 调用 APP-KB 的标准入口。
>
> 其他子文件：[页面专属 Agent](./PRD-APP-DW-页面专属Agent_v1.0-20260722.md)

---

## 1. 角色定义

业务 RAG 知识库数字员工是 APP-DW 中的一种**专用数字员工类型**（区别于通用对话/任务型数字员工），专门用于：

- **封装 APP-KB 知识库的检索能力**为可被 A2A 调用的 Agent
- **充当 COPILOT 与 KB 之间的中介**：COPILOT 不直接调用 KB，而是调用这个中介
- **支持跨域协同**：每个业务域一个数字员工（如"法务/财务/HR/技术"），COPILOT 可并行调用多路

**与其他类型数字员工的区别**：

| 维度 | 通用数字员工 | 业务 RAG 知识库数字员工 |
|------|------------|---------------------|
| 主要能力 | 对话、任务执行、工具调用 | 知识库检索 + 引用溯源 |
| 注册位置 | APP-DW | APP-DW（特殊标记为 `agentType=BUSINESS_RAG_KB`） |
| 调用方 | 用户 / 内部任务编排 | **主要被 APP-COPILOT 通过 A2A 调用** |
| Agent Card | 标准 A2A Card | 标准 A2A Card + `businessDomain` + `knowledgeBaseIds` 元数据 |
| 行为模式 | 主动响应用户 | 被动响应 COPILOT 调度 |
| 输出格式 | 自然语言 | 结构化（chunks + citations + summary） |

---

## 2. 创建流程（FR-DW-008-01）

业务 RAG 知识库数字员工的创建采用**向导式**：

| 步骤 | 操作 | 系统行为 |
|------|------|---------|
| 1 | 在 APP-DW 创建数字员工，类型选「业务 RAG 知识库」 | 自动生成 Agent Card 骨架 |
| 2 | 填写基础信息：名称、描述、所属业务域（法务/财务/HR/技术等） | 写入 `digital_worker` 表 |
| 3 | 绑定知识库：从 APP-KB 选择 1~N 个知识库（多选） | 写入 `dw_kb_binding` 表（关联 `kb_knowledge_base`） |
| 4 | 配置检索策略：topK、相似度阈值、重排序模型、引用条数、是否流式 | 写入 `dw_retrieval_config` 表 |
| 5 | 配置系统提示词（可选）：限定回答范围、领域术语 | 写入数字员工 metadata |
| 6 | 测试调用：在向导内提供测试输入，验证检索效果 | 调用 KB 检索 API |
| 7 | 发布上线：注册到 Nacos A2A Registry | 发布 Agent Card + 触发 COPILOT 自动发现 |

---

## 3. Agent Card 规范（FR-DW-008-02）

业务 RAG 知识库数字员工的 Agent Card 必须包含以下字段（遵循 A2A 协议 + 平台扩展）：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 是 | 唯一标识（如 `legal-knowledge-agent`） |
| `displayName` | string | 是 | 中文展示名（如"法务知识库数字员工"） |
| `description` | string | 是 | 能力描述，用于 COPILOT 路由决策 |
| `version` | string | 是 | 语义化版本 |
| `endpoint` | string | 是 | A2A 调用入口（`/api/v1/a2a/agents/{name}/invoke`） |
| `capabilities` | string[] | 是 | 能力标签（`rag.search`、`rag.cite`、`rag.multihop`） |
| `inputSchema` | object | 是 | 输入参数 JSON Schema |
| `outputSchema` | object | 是 | 输出参数 JSON Schema |
| `auth` | object | 是 | OAuth2 鉴权配置 |
| `metadata.businessDomain` | string | 是 | 业务域（`legal`/`finance`/`hr`/`tech`/自定义） |
| `metadata.knowledgeBaseIds` | string[] | 是 | 绑定的 KB ID 列表 |
| `metadata.ownerOrg` | string | 是 | 所属组织 |
| `metadata.sla` | object | 否 | SLA 配置（P95 延迟、可用性） |

---

## 4. A2A 调用处理（FR-DW-008-03）

数字员工接收 A2A 调用后的处理流程：

```
A2A 调用到达 → 数字员工 Controller
  ↓
1. 鉴权：校验 Bearer Token + IAM 权限（scopes: dw.invoke）
  ↓
2. 参数解析：提取 query、context、topK、kbFilters
  ↓
3. 查询绑定的 KB：通过 dw_kb_binding 表获取 knowledgeBaseIds
  ↓
4. 调用 TECH-RAG → APP-KB 检索 API：
     ├─ 单 KB：POST /api/v1/knowledge-base/search
     └─ 多 KB：循环调用并合并结果
  ↓
5. 重排序与裁剪（按 topK）
  ↓
6. 构造响应：
     ├─ chunks[]（含原文 + 元数据 + 分数）
     ├─ citations[]（KB + 文档溯源）
     └─ summary（基于 chunks 的简要回答）
  ↓
7. 记录检索日志（traceId + 调用方 + 检索参数）
  ↓
8. 通过 A2A 返回结果（含 X-Trace-Id）
```

---

## 5. 性能与配额（FR-DW-008-04）

| 指标 | 默认值 | 可配置 |
|------|--------|--------|
| 单次检索 topK | 10 | 1~100 |
| 单次调用超时 | 5s | 1~30s |
| 并发调用上限 | 50 QPS/员工 | 1~500 |
| 调用方限速 | 10 QPS/用户 | 可调 |
| KB 调用次数/请求 | 1~5 KB | 受绑定数量限制 |
| 流式响应 | 启用 | 可关闭 |

---

## 6. 监控指标（FR-DW-008-05）

每个业务 RAG 知识库数字员工暴露以下监控指标（TECH-OBS）：

| 指标 | 用途 |
|------|------|
| `dw_rag_invoke_total` | 总调用次数（按调用方/状态码） |
| `dw_rag_invoke_latency_ms` | P50/P95/P99 延迟 |
| `dw_rag_chunks_retrieved` | 单次检索返回段落数分布 |
| `dw_rag_top_score` | Top-1 相似度分布（衡量检索质量） |
| `dw_rag_feedback_like_rate` | 反馈点赞率 |
| `dw_rag_kb_call_latency` | KB 检索延迟（识别 KB 性能瓶颈） |
| `dw_rag_token_consumed` | Token 消耗（间接通过 summary） |

---

## 7. 跨域协同（FR-DW-008-06）

业务 RAG 知识库数字员工支持被 COPILOT 并行调用，处理跨业务域问题：

```
COPILOT 识别"差旅中受伤算不算工伤？"
  ├─ A2A → 法务知识库数字员工 → 检索"差旅""工伤"法务条款
  ├─ A2A → HR 知识库数字员工 → 检索"工伤认定""劳动法"HR 制度
  └─ LLM 综合两路结果 + 引用，生成统一回答
```

数字员工侧的协同约束：

| 约束 | 说明 |
|------|------|
| 单路超时 | 5s（独立超时，不互相阻塞） |
| 失败隔离 | 任一路失败不影响其他路 |
| 结果去重 | 跨路相同引用合并 |
| 来源标签 | 每条结果携带 `businessDomain`，便于汇总时区分 |

---

## 8. 与 APP-COPILOT / APP-KB 的关系

```
APP-COPILOT（调度者）
     │
     │ A2A 调用
     ▼
APP-DW 业务 RAG 知识库数字员工（执行者，本文件定义）
     │
     │ HTTP 调用（无 A2A 感知）
     ▼
APP-KB 知识库（资产）
     │
     ▼
TECH-RAG（底层检索）
```

**关键设计原则**：

1. **COPILOT 不直接绑知识库**：必须通过数字员工封装，避免 KB 散落
2. **数字员工是 KB 的唯一封装层**：每个业务域一个数字员工，便于权限、审计、调优
3. **A2A 协议标准化**：数字员工注册到 Nacos A2A Registry，COPILOT 自动发现
4. **KB 不感知 A2A**：KB API 保持简洁，由数字员工侧负责协议封装
5. **traceId 全链路**：COPILOT → A2A → 数字员工 → KB → TECH-RAG 端到端追踪

---

## 9. 设计基线

| 维度 | 取值 |
|------|------|
| 设计库 | MetaPlatform3.0（id: `_-ZRH2U5YKIYA4`） |
| 主题 | Dark theme |
| 颜色 token | `--background:#0a0a0a`、`--card:#111111`、`--border:#262626`、`--primary:#fafafa` |
| 字体 | Geist |
| 组件前缀 | `.v-card`、`.v-btn`、`.v-table`、`.v-input`、`.v-tab`、`.v-badge-*` |

---

**PRD 版本**: v1.0（子文件）
**PRD 日期**: 2026-07-22
**关联主 PRD**: [`PRD-APP-DW-数字员工_v2.3-20260722.md`](./PRD-APP-DW-数字员工_v2.3-20260722.md)
**关联 PRD**: [`PRD-APP-KB-知识库_v1.1-20260722.md`](../APP-KB/PRD-APP-KB-知识库_v1.1-20260722.md)

---

## 附录：vv1.0 → vv1.1 增量更新说明

> **更新日期**: 2026-07-27
> **归属后端服务**: MATE-AGENT + TECH-RAG

### 一、主要变更

1. 范围对齐主 PRD 同步
2. API 接口按 Q2=B 决策归属 **MATE-AGENT + TECH-RAG**
3. 新增「待补交互清单」章节
4. 数据模型与前端类型同步

### 二、待补交互清单

见主 PRD 的「待补交互清单」章节，本子 PRD 的所有交互均继承主 PRD 的标记。

### 三、API 接口概要

本子 PRD 的所有端点归属 **MATE-AGENT + TECH-RAG**，完整端点列表见：
- `docs/prd/_top/API-CONTRACT-前端接口契约清单_v1.0-20260727.md` §3.x

### 四、关联文档

- `docs/prd/_top/API-CONTRACT-前端接口契约清单_v1.0-20260727.md`
- `docs/prd/_top/PLAN-前后端并行开发接口边界_v1.0-20260727.md`
- `docs/prd/_top/REPORT-前端实现与PRD差异盘点_v1.0-20260727.md`
