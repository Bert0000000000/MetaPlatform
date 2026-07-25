# PRD - APP-COPILOT 调度与总结（子文件）

> **版本**: v1.0 | **日期**: 2026-07-22 | **关联主 PRD**: [`PRD-APP-COPILOT_v2.2-20260722.md`](./PRD-APP-COPILOT_v2.2-20260722.md) | **状态**: 正式版候选
>
> 本文件是 APP-COPILOT 的**子文件**，专门描述 SuperAI 的"**顶层调度 + 跨域知识总结**"能力（FR-AI-009/010/011）。
>
> 其他子文件：[超级AI对话](./PRD-APP-COPILOT-超级AI对话_v2.1-20260722.md)

---

## 1. 能力定位

### 1.1 与主 PRD 的关系

本文件是主 PRD 中 §2.7「顶层调度与知识总结」FR 簇（FR-AI-009/010/011）的详细展开。

### 1.2 核心职责

| 能力 | 职责 |
|------|------|
| **顶层调度** | 根据用户问题，从 Nacos A2A Registry 发现合适的专属 Agent，并行/串行调度它们 |
| **知识总结** | 将多个 Agent 的输出融合成结构化、全局视角的回答 |
| **顶层入口** | 提供独立对话窗口（不嵌入任何业务页面） |

### 1.3 与各 Agent 的协作

```
用户问题（SuperAI 顶层入口）
    ↓
意图识别（识别业务域、应用、所需能力）
    ↓
Agent 发现（Nacos A2A Registry）
    ↓
Agent 筛选（按 businessDomain / capabilities）
    ↓
单域 → 调度 1 个 Agent
跨域 → 并行调度 N 个 Agent
链式 → 串行调度多个 Agent
    ↓
LLM 汇总（融合多路输出，生成统一回答）
    ↓
回答（含引用：Agent → KB → 文档 → 段落）
```

---

## 2. 顶层调度能力（FR-AI-009）

### 2.1 功能列表

| 编号 | 功能项 | 优先级 | 描述 |
|------|--------|--------|------|
| FR-AI-009-01 | Agent 发现 | P0 | 通过 Nacos A2A Registry 查询所有可用的专属 Agent（按业务域、能力标签、Agent Card 描述） |
| FR-AI-009-02 | 意图路由 | P0 | 根据用户问题识别需要调用的 Agent（单域 / 多域 / 跨应用） |
| FR-AI-009-03 | 单 Agent 调度 | P0 | 调用单个专属 Agent 完成专业领域回答 |
| FR-AI-009-04 | 多 Agent 并行调度 | P0 | 同时调度多个专属 Agent（跨业务域问题），结果并行返回 |
| FR-AI-009-05 | 多 Agent 串行调度 | P1 | 前一个 Agent 的输出作为下一个 Agent 的输入（链式调用） |
| FR-AI-009-06 | 调度超时控制 | P0 | 单 Agent 5s，整体调度 10s 内必须返回 |
| FR-AI-009-07 | 失败降级 | P0 | Agent 失败时降级到下一个候选 Agent 或 KB 直连 |
| FR-AI-009-08 | 调度审计 | P0 | 记录每次调用的 traceId、Agent 列表、耗时、结果摘要 |

### 2.2 调度决策流程

```
用户问题
    ↓
意图识别（识别业务域、应用、所需能力）
    ↓
Agent 发现（Nacos A2A Registry）
    ↓
Agent 筛选（按 businessDomain / capabilities / 当前页面上下文）
    ↓
单域 → 调度 1 个 Agent
跨域 → 并行调度 N 个 Agent
链式 → 串行调度多个 Agent
    ↓
LLM 汇总（融合多路输出，生成统一回答）
    ↓
回答（含引用：Agent → KB → 文档 → 段落）
```

### 2.3 调度策略配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| 单 Agent 超时 | 5s | 单 Agent 调用超时 |
| 整体超时 | 10s | 调度链整体超时 |
| 并发数上限 | 5 路 | 单次请求最多 5 个 Agent 并行 |
| 失败重试 | 1 次 | 单 Agent 失败重试 1 次 |
| 降级策略 | KB 直连 | Agent 全失败时降级 |

---

## 3. 知识总结能力（FR-AI-010）

### 3.1 功能列表

| 编号 | 功能项 | 优先级 | 描述 |
|------|--------|--------|------|
| FR-AI-010-01 | 多源融合 | P0 | 融合多 Agent 输出（可能内容冲突时按权威性排序） |
| FR-AI-010-02 | 引用溯源整合 | P0 | 整合各 Agent 的引用溯源，标注每条信息的来源 Agent |
| FR-AI-010-03 | 业务域标签 | P0 | 回答中明确每条结论对应的业务域（如"法务视角""HR 视角"） |
| FR-AI-010-04 | 结构化输出 | P1 | 自动选择最佳呈现形式（列表/表格/分类） |
| FR-AI-010-05 | 不确定性提示 | P1 | 当 Agent 输出冲突或置信度低时，明确告知用户 |
| FR-AI-010-06 | 长对话上下文 | P0 | 多轮对话中保持全局上下文，跨 Agent 引用历史回答 |

### 3.2 融合策略

| 冲突类型 | 策略 |
|---------|------|
| 多 Agent 输出矛盾 | 按业务域权威性排序（与用户角色匹配的业务域优先） |
| 多 Agent 引用同一来源 | 合并引用，标注来源 Agent 列表 |
| 部分 Agent 失败 | 标记缺失维度，建议用户稍后重试 |
| 输出格式不一致 | 由 LLM 统一规范化 |

---

## 4. 顶层入口特性（FR-AI-011）

### 4.1 功能列表

| 编号 | 功能项 | 优先级 | 描述 |
|------|--------|--------|------|
| FR-AI-011-01 | 独立对话窗口 | P0 | SuperAI 有独立对话窗口（不内嵌到任何业务页面） |
| FR-AI-011-02 | 全局快捷键 | P1 | 全平台任意位置可通过快捷键（如 Ctrl+Shift+I）唤起 SuperAI |
| FR-AI-011-03 | 对话历史 | P0 | SuperAI 对话历史独立保存（与页面内 Agent 对话历史分离） |
| FR-AI-011-04 | Agent 调用可视化 | P1 | 用户可看到 SuperAI 调度了哪些 Agent、每个 Agent 返回了什么 |
| FR-AI-011-05 | 调度策略配置 | P2 | 管理员可配置 SuperAI 的默认调度策略（Agent 优先级、超时等） |

### 4.2 与页面专属 Agent 的协作模式

虽然 SuperAI 不嵌入页面，但可以**主动拉起**或**被动响应**：

| 模式 | 触发方式 | 场景 |
|------|---------|------|
| **页面内独立交互** | 用户在页面内直接与专属 Agent 对话 | 主要模式（80% 场景） |
| **页面→SuperAI 跳转** | 页面内 Agent 检测到跨域需求，建议用户跳转 SuperAI | "这个问题涉及 HR，建议去 SuperAI 询问" |
| **SuperAI→页面跳转** | SuperAI 调度结果需要用户到特定页面操作 | SuperAI 调度建模 Agent 后，建议"去建模页面应用这个方案" |
| **共享上下文** | SuperAI 与页面 Agent 共享必要的对话上下文 | 用户在建模页面问的问题，可带入 SuperAI 继续追问 |

> **重要原则**：SuperAI 与页面专属 Agent **不共享对话历史**，但可以通过用户主动"带到 SuperAI"的机制传递必要上下文。

---

## 5. 非功能需求

| 类别 | 要求 |
|------|------|
| 调度响应延迟 | P95 < 5s（单 Agent）/ < 10s（多 Agent 协同） |
| Agent 发现缓存 | Agent Card 缓存 60s |
| 并发调度 | 单用户最多 5 路并行 |
| 调度审计 | 100% 记录 traceId |
| 失败降级 | Agent 失败时自动降级到 KB 直连 |

---

## 6. 数据模型概要

### 6.1 调度记录（SchedulingRecord）

```
SchedulingRecord
├── id: UUID (PK)
├── sessionId: String (FK -> ChatSession.id)
├── userId: String (FK -> User.id)
├── query: Text  // 用户原始问题
├── routeResult: JSON  // 路由结果 {agents: [...], mode: SINGLE|PARALLEL|CHAIN}
├── agentInvocations: JSON  // 各 Agent 调用记录 [{agentId, latencyMs, status, output}]
├── summary: Text  // 汇总后的最终回答
├── totalLatencyMs: Integer
├── traceId: String
├── status: Enum [SUCCESS, PARTIAL, FAILED, FALLBACK]
├── createdAt: Timestamp
└── completedAt: Timestamp
```

### 6.2 数据库表映射

| 实体 | 数据库表 |
|------|---------|
| SchedulingRecord | `copilot_scheduling_records` |

---

## 附录 A：与页面专属 Agent 的交互协议

详细 A2A 调用规范见 `docs/prd/APP-DW/PRD-APP-DW-页面专属Agent_v1.0-20260722.md` 与 `docs/prd/APP-DW/PRD-APP-DW-业务RAG知识库Agent_v1.0-20260722.md`。

---

**PRD 版本**: v1.0（子文件）
**PRD 日期**: 2026-07-22
**关联主 PRD**: [`PRD-APP-COPILOT_v2.2-20260722.md`](./PRD-APP-COPILOT_v2.2-20260722.md)