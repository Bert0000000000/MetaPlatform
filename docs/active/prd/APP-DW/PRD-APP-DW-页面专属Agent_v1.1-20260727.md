# PRD - APP-DW-页面专属Agent

> **版本**: v1.1 | **日期**: 2026-07-27
>
> **vv1.0 → vv1.1 主要变更**：
> 1. 与主 PRD 同步更新
> 2. API 接口按 Q2=B 归属 MATE-AGENT
> 3. 新增「待补交互清单」
> 4. 关联文档：`API-CONTRACT-前端接口契约清单_v1.0-20260727.md`、`PLAN-前后端并行开发接口边界_v1.0-20260727.md`

---


> **版本**: v1.0 | **日期**: 2026-07-22 | **关联主 PRD**: [`PRD-APP-DW-数字员工_v2.3-20260722.md`](./PRD-APP-DW-数字员工_v2.3-20260722.md) | **状态**: 正式版候选
>
> 本文件是 APP-DW 的**子文件**，专门描述页面/应用专属数字员工 Agent（agentType=`PAGE_SPECIFIC`），嵌入每个业务页面提供 AI 交互。
>
> 其他子文件：[业务 RAG 知识库 Agent](./PRD-APP-DW-业务RAG知识库Agent_v1.0-20260722.md)

---

## 1. 角色定义

**页面/应用专属数字员工 Agent**（简称"专属 Agent"）是 APP-DW 中的另一种**专用数字员工类型**，与"业务 RAG 知识库数字员工"并列：

- **部署位置**：嵌入每个业务页面/应用，作为页面内的 AI 助手
- **主要职责**：聚焦该页面/应用的专业领域内容，深度辅助用户操作
- **调用关系**：①用户在页面内**直接与专属 Agent 交互**（80% 场景）②**被 SuperAI 通过 A2A 调度**（跨域场景）
- **典型特征**：领域聚焦、上下文丰富（拥有当前页面状态）、操作能力强（可调用页面 Action）

---

## 2. 与其他类型数字员工的区别

| 维度 | 通用数字员工 | 业务 RAG 知识库 Agent | **页面/应用专属 Agent** |
|------|------------|----------------------|------------------------|
| 主要能力 | 通用对话 | 知识库检索 + 引用 | 页面操作辅助 + 专业咨询 |
| 部署位置 | APP-DW 单独运行 | APP-DW 单独运行 | **嵌入业务页面** |
| 调用方 | 用户 / 任务编排 | SuperAI（A2A） | **用户在页面内** + SuperAI（A2A） |
| 上下文 | 通用 | 仅 query + KB 元数据 | **当前页面状态 + 表单 + 选中数据** |
| 行为模式 | 独立运行 | 被动响应 | **嵌入页面，引导用户操作** |
| 输出形式 | 自然语言 | 结构化（chunks + citations） | 自然语言 + **页面内操作建议** |

---

## 3. 平台默认专属 Agent 矩阵（FR-DW-009-01）

平台初始化时，预置以下专属 Agent（每个业务页面一个，可按需扩展）：

| 业务模块 | 专属 Agent | 核心能力 | 嵌入页面 |
|---------|-----------|---------|---------|
| APP-DASHBOARD | **工作台专属 Agent** | 待办解读、指标异常分析、快捷入口推荐 | dashboard、dashboard-myapps、dashboard-myagents |
| APP-APPHUB | **应用建模专属 Agent** | 表单字段建议、数据模型设计、应用配置咨询 | apps-modeling、apps-create、apps-config |
| APP-APPHUB | **流程设计专属 Agent** | 流程节点配置、审批人推荐、流程优化 | apps-processdesigner、apps-forms-flows |
| APP-ONTSTUDIO | **本体建模专属 Agent** | 概念定义建议、关系推荐、Schema 校验 | ontology-modeling、ontology-modeling-detail |
| APP-ONTSTUDIO | **概念抽取 Agent** | 从文本中抽取本体候选、批量标注 | agents-knowledge（也属于 APP-DW） |
| APP-MCPHUB | **MCP 调试专属 Agent** | 工具调用排错、参数推荐、Schema 解读 | mcp-debugger、mcp-tools |
| APP-KB | **各业务 RAG 知识库 Agent** | （详见独立子文件） | ontology-knowledgebase |
| APP-DW | **数字员工配置 Agent** | 数字员工创建向导、能力配置咨询 | agents-create、agents-list |
| APP-ARCH | **架构梳理专属 Agent** | 业务能力梳理、应用依赖分析、架构治理 | arch-business、arch-app、arch-data、arch-tech |

---

## 4. 专属 Agent 创建流程（FR-DW-009-02）

平台提供**专属 Agent 模板**，业务模块启用时自动部署专属 Agent：

| 步骤 | 操作 | 系统行为 |
|------|------|---------|
| 1 | 业务模块启用（如 APP-DASHBOARD） | 系统自动部署预置专属 Agent（如"工作台专属 Agent"） |
| 2 | 管理员配置 Agent 元数据 | 名称、描述、能力声明、提示词 |
| 3 | 配置页面上下文注入 | 选择 Agent 可访问的页面状态（表单字段、选中数据、当前路由） |
| 4 | 配置可调用的 Action | 列出 Agent 在该页面可执行的操作（如"创建表单""修改字段"） |
| 5 | 绑定知识库（可选） | 关联 APP-KB 中的业务知识库 |
| 6 | 测试交互 | 在该业务页面测试 Agent 响应 |
| 7 | 发布上线 | 嵌入业务页面，同时注册到 Nacos A2A Registry |

---

## 5. 页面上下文注入规范（FR-DW-009-03）

专属 Agent 相比通用 Agent 的核心优势是**拥有当前页面的完整上下文**：

**上下文注入字段**（页面自动注入到 Agent 输入）：

```json
{
  "pageContext": {
    "module": "APP-APPHUB",
    "page": "apps-modeling",
    "pageInstance": {
      "appId": "app-12345",
      "appName": "员工请假系统",
      "currentEntity": "LeaveRequest",
      "currentFields": [
        {"name": "leaveType", "type": "Enum", "required": true, "value": null},
        {"name": "startDate", "type": "Date", "required": true, "value": null}
      ]
    },
    "userAction": {
      "type": "field_focus",
      "field": "leaveType",
      "timestamp": "2026-07-22T10:30:00Z"
    }
  }
}
```

**Agent 输出可包含操作建议**（被前端执行）：

```json
{
  "reply": "建议将 leaveType 设置为必填枚举字段，选项包括事假/病假/年假。",
  "suggestions": [
    {
      "action": "addFieldOption",
      "field": "leaveType",
      "options": [{"value": "personal", "label": "事假"}, {"value": "sick", "label": "病假"}, {"value": "annual", "label": "年假"}]
    }
  ]
}
```

---

## 6. A2A 调用规范（FR-DW-009-04）

专属 Agent 同时被 SuperAI 通过 A2A 调用，输入参数与业务 RAG Agent 兼容，但额外支持 `pageContext` 透传：

```http
POST /api/v1/a2a/agents/{agentName}/invoke
Authorization: Bearer {token}
X-Trace-Id: {traceId}
Content-Type: application/json

{
  "task": "page.specialized.consult",
  "input": {
    "query": "如何配置请假类型字段？",
    "pageContext": { ... },  // 可选：从页面带入的上下文
    "kbFilters": { ... }
  }
}
```

---

## 7. 性能与配额（FR-DW-009-05）

| 指标 | 默认值 | 说明 |
|------|--------|------|
| 页面内响应 P95 | < 2s | 用户在页面内等待时间 |
| 流式响应 | 启用 | 长回答流式输出 |
| 上下文大小 | ≤ 8K tokens | 超出截断 |
| A2A 调用超时 | 5s | SuperAI 调度超时 |
| 单用户并发 | 3 路 | 防止页面卡顿 |

---

## 8. 监控指标（FR-DW-009-06）

每个专属 Agent 暴露以下监控指标（TECH-OBS）：

| 指标 | 用途 |
|------|------|
| `dw_page_agent_invoke_total` | 页面内调用次数（按用户/页面） |
| `dw_page_agent_invoke_latency_ms` | P50/P95/P99 延迟 |
| `dw_page_agent_suggestion_accepted_rate` | Agent 操作建议被用户接受率 |
| `dw_page_agent_kb_hit_rate` | 知识库命中率 |
| `dw_page_agent_a2a_invoke_total` | 被 SuperAI A2A 调用次数 |
| `dw_page_agent_user_satisfaction` | 用户满意度评分 |

---

## 9. 与 SuperAI / 业务 RAG Agent 的关系

```
┌────────────────────────────────────────────────────────────────┐
│                       用户使用场景                                │
└────────────────────────────────────────────────────────────────┘
        │                                       │
        ▼                                       ▼
┌──────────────────────┐              ┌─────────────────────────┐
│ 业务页面内体验         │              │ SuperAI 顶层入口         │
│ ─────────────────── │              │ ─────────────────────  │
│ 用户在某个页面         │              │ 用户主动打开 SuperAI    │
│ （如 apps-modeling） │              │ 全局对话                  │
│        │             │              │        │                │
│        ▼             │              │        ▼                │
│  页面专属 Agent       │              │   SuperAI（调度者）      │
│  （聚焦当前页面）     │              │   ├─ 业务 RAG Agent     │
│       │              │              │   ├─ 页面专属 Agent     │
│       │              │              │   └─ LLM 汇总           │
│       ▼              │              │        │                │
│  APP-KB / 工具       │              │        ▼                │
│                      │              │   全局视角回答          │
└──────────────────────┘              └─────────────────────────┘
```

**关键原则**：

1. **页面内体验完全独立**：专属 Agent 在页面内响应，不依赖 SuperAI
2. **SuperAI 可跨域调度**：需要跨页面/跨域时，SuperAI 通过 A2A 调用多个 Agent（含专属 Agent）
3. **上下文可携带**：用户在页面内的问题，可"带到" SuperAI 继续追问（上下文显式传递）
4. **去重与协同**：专属 Agent 与业务 RAG Agent 可能绑定相同 KB，由 Agent Card 的 capabilities 区分

---

## 10. 自定义专属 Agent（FR-DW-009-07）

除平台预置外，业务部门可创建自定义专属 Agent 嵌入自定义应用：

| 步骤 | 操作 |
|------|------|
| 1 | 在 APP-DW 创建数字员工，类型选「页面/应用专属」 |
| 2 | 填写 Agent 元数据，绑定目标应用 ID |
| 3 | 配置页面上下文 Schema（自定义应用的前端约定） |
| 4 | 配置可调用的 Action（自定义应用 API） |
| 5 | 在自定义应用中嵌入 Agent 组件，传入 pageContext |
| 6 | 发布到 Nacos A2A Registry |

---

## 11. 设计基线

| 维度 | 取值 |
|------|------|
| 设计库 | MetaPlatform3.0（id: `_-ZRH2U5YKIYA4`） |
| 主题 | Dark theme |
| 颜色 token | `--background:#0a0a0a`、`--card:#111111`、`--border:#262626`、`--primary:#fafafa` |
| 字体 | Geist |
| 形状 | `--radius:8px`，1px 边框，零阴影 |
| 组件前缀 | `.v-card`、`.v-btn`、`.v-input`、`.v-tab`、`.v-badge-*` |

---

**PRD 版本**: v1.0（子文件）
**PRD 日期**: 2026-07-22
**关联主 PRD**: [`PRD-APP-DW-数字员工_v2.3-20260722.md`](./PRD-APP-DW-数字员工_v2.3-20260722.md)
**关联 PRD**: [`PRD-APP-COPILOT_v2.2-20260722.md`](../APP-COPILOT/PRD-APP-COPILOT_v2.2-20260722.md)

---

## 附录：vv1.0 → vv1.1 增量更新说明

> **更新日期**: 2026-07-27
> **归属后端服务**: MATE-AGENT

### 一、主要变更

1. 范围对齐主 PRD 同步
2. API 接口按 Q2=B 决策归属 **MATE-AGENT**
3. 新增「待补交互清单」章节
4. 数据模型与前端类型同步

### 二、待补交互清单

见主 PRD 的「待补交互清单」章节，本子 PRD 的所有交互均继承主 PRD 的标记。

### 三、API 接口概要

本子 PRD 的所有端点归属 **MATE-AGENT**，完整端点列表见：
- `docs/prd/_top/API-CONTRACT-前端接口契约清单_v1.0-20260727.md` §3.x

### 四、关联文档

- `docs/prd/_top/API-CONTRACT-前端接口契约清单_v1.0-20260727.md`
- `docs/prd/_top/PLAN-前后端并行开发接口边界_v1.0-20260727.md`
- `docs/prd/_top/REPORT-前端实现与PRD差异盘点_v1.0-20260727.md`
