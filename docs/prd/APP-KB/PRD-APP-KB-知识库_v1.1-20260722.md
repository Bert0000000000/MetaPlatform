# PRD - 知识库（APP-KB）

> 版本：v1.0 | 日期：2026-07-22 | 模块：APP-KB | 状态：正式版候选（新模块首版）
>
> **新增模块**：根据设计稿 `metaplatform-design-draft/pages/ontology-knowledgebase.html`（设计稿标记为 `page-knowledge-base`）识别为独立模块，从 APP-ONTSTUDIO 抽离内容资产能力。
>
> **设计稿位置**：group 5（独立于 APP-ONTSTUDIO 的 group 4），顶部导航项 `nav-knowledge`。

---

## 1. 模块概述

### 1.1 模块定位

APP-KB 是 Mate Platform 的**企业级知识资产中心**，提供统一的文档管理、文档解析、向量化、检索与版本管理能力。被 APP-COPILOT（RAG 检索）、APP-DW（数字员工知识库）、APP-APPHUB（应用内置知识库）消费。

### 1.2 核心价值

- **统一内容资产**：一个知识库模块覆盖所有业务场景
- **智能解析**：支持 PDF/Word/Markdown/Excel 等多格式自动解析与切片
- **混合检索**：向量检索 + BM25 关键词检索 + 重排序
- **可观测性**：检索质量、调用次数、命中率全程可观测
- **与 Ontology 解耦**：知识库关注"内容"，Ontology 关注"语义"，二者通过 TECH-ONT/TECH-RAG 协同

### 1.3 目标用户

| 角色 | 使用场景 |
|------|----------|
| 知识库管理员 | 创建/维护知识库、权限管理、版本管理 |
| 业务专家 | 上传业务文档、审核解析结果、标注切片 |
| 数字员工开发者 | 绑定知识库到数字员工 |
| 终端用户 | 通过 APP-COPILOT 或 APP-DW 间接消费知识库 |

### 1.4 与 APP-ONTSTUDIO 的边界

| 能力 | APP-KB（内容资产） | APP-ONTSTUDIO（语义建模） |
|------|-------------------|--------------------------|
| 文档上传/解析/切片 | ✅ | ❌ |
| 向量索引与检索 | ✅ | ❌ |
| 知识库 CRUD | ✅ | ❌ |
| 概念定义（Concept/Entity/Relation） | ❌ | ✅ |
| Ontology 概念检索 | ❌ | ✅ |
| 业务规则 | ❌ | ✅ |

### 1.5 设计稿对应

| 设计稿页面 | URL | 备注 |
|----------|-----|------|
| 知识库主页 | `metaplatform-design-draft/pages/ontology-knowledgebase.html` | 设计稿中标记为 `page-knowledge-base` |
| 顶部导航 | `nav-knowledge` → `page-knowledge-base` | group 5 独立模块 |

---

## 2. 用户动线总览

### 2.1 核心动线

```
知识库管理员 → 创建知识库 → 配置权限/嵌入模型
        ↓
业务专家 → 上传文档 → 自动解析/切片 → 人工审核
        ↓
系统 → 异步向量化 → 索引构建 → 上线
        ↓
下游消费方（APP-COPILOT/APP-DW/APP-APPHUB）→ 绑定知识库 → 检索使用
        ↓
管理员/专家 → 持续优化 → 重新切片/标注/反馈
```

### 2.2 典型场景

#### 场景 0（核心场景）：COPILOT 通过 A2A 调用业务 RAG 知识库数字员工

这是本平台**最关键的一条知识检索链路**：业务用户在 APP-COPILOT 自然语言提问，COPILOT 不直接检索知识库，而是通过 **A2A 协议**调度由 APP-DW 创建的"业务 RAG 知识库数字员工"，由该数字员工绑定 APP-KB 中的业务知识库完成检索，最终由 COPILOT 汇总多路结果并回复用户。

**调用链路（端到端）**：

```
用户 ─提问─→ APP-COPILOT
              │
              ▼ (意图识别 + 任务规划)
       SAA Graph Core（TECH-AGENT）
              │
              ▼ (A2A Protocol, Spring AI Alibaba A2A Nacos)
   ┌──────────────────────────────────────────────┐
   │  业务 RAG 知识库数字员工（APP-DW 实例）          │
   │  ─────────────────────────────────────────── │
   │  1. 接收 COPILOT 的检索任务（query + 上下文）   │
   │  2. 识别任务所属业务域（如"法务"/"财务"/"HR"）   │
   │  3. 选择绑定的 APP-KB 知识库（可多选）          │
   │  4. 通过 TECH-RAG 调用知识库检索接口             │
   │     ├─ 向量检索（Milvus）                       │
   │     ├─ 关键词检索（BM25）                       │
   │     └─ 重排序（BGE-reranker）                   │
   │  5. 整理 Top-K 段落 + 引用溯源                   │
   │  6. 通过 A2A 返回结果给 COPILOT                  │
   └──────────────────────────────────────────────┘
              │
              ▼
       APP-COPILOT 汇总多路结果
              │
              ▼ (TECH-LLMGW 流式生成)
       回答 + 引用来源 ─→ 用户
```

**典型子场景**：

| 子场景 | 用户提问 | 调用的业务 RAG 数字员工 | 检索的知识库 |
|--------|---------|----------------------|------------|
| 法律咨询 | "我们和供应商的违约金条款上限是多少？" | 法务知识库数字员工 | 公司法务知识库 |
| 财务查询 | "2024 年 Q3 各部门差旅报销上限" | 财务知识库数字员工 | 财务制度知识库 |
| HR 咨询 | "试用期最长多久？转正流程是什么？" | HR 知识库数字员工 | HR 制度知识库 |
| 跨域问答 | "差旅中受伤算不算工伤？" | 法务 + HR 双员工协同 | 法务 + HR 知识库 |

**关键设计要点**：

1. **COPILOT 不直接绑知识库**：COPILOT 是"调度者"，业务 RAG 数字员工是"执行者"，知识库是"资产"，三者解耦
2. **A2A 协议标准化**：数字员工通过 Nacos 3.0+ A2A Registry 注册，COPILOT 通过 Agent Card 发现并调用
3. **权限穿透**：COPILOT 调用数字员工时，数字员工需校验调用方身份（OAuth2 Bearer Token 透传）
4. **多路并行**：跨域问题可并行调用多个数字员工，COPILOT 汇总
5. **审计闭环**：每条 A2A 调用都记录 traceId，跨服务追踪（TECH-OBS）

#### 场景 1：法务知识库上线
1. 法务部管理员在 APP-KB 创建「公司法务知识库」
2. 上传 200 份历史合同范本（PDF/Word）
3. 系统自动解析、切片、向量化
4. 管理员审核切片质量，标注重点段落
5. 法务部成员在 APP-DW 创建「法务知识库数字员工」
6. 数字员工绑定「公司法务知识库」（+ 配置检索策略）
7. 数字员工通过 Nacos A2A Registry 注册，发布 Agent Card
8. APP-COPILOT 通过 A2A 发现该数字员工，可被调度

#### 场景 2：APP-COPILOT 通过 A2A 调用数字员工
1. 业务用户在 APP-COPILOT 提问"合同违约金上限"
2. COPILOT 意图识别为"法务咨询"，路由到 SAA Graph Core
3. SAA Graph Core 在 Nacos A2A Registry 中查找"法务知识库数字员工"
4. 通过 A2A 协议发送检索任务（含 query + 用户上下文 + traceId）
5. 数字员工调用绑定的 APP-KB 知识库完成检索
6. 数字员工整理 Top-K 段落 + 引用，通过 A2A 返回
7. COPILOT 流式生成最终回答，附引用来源，跳转数字员工详情

#### 场景 3：跨域协同（法务 + HR）
1. 用户问"差旅中受伤算不算工伤？"
2. COPILOT 识别为多业务域问题，触发多 Agent 编排
3. 并行调用"法务知识库数字员工" + "HR 知识库数字员工"
4. 两路结果返回 COPILOT，统一上下文，由 LLM 综合生成
5. 用户看到一份整合的"法务 + HR"双视角回答

#### 场景 4：知识库版本回滚
1. 管理员发现新上传文档导致检索质量下降
2. 查看版本历史，定位到上一个稳定版本
3. 一键回滚（索引快照级别，不影响原文档）
4. **联动通知**：通过 A2A 通知所有绑定该知识库的数字员工刷新缓存
5. 重新评估检索质量

---

## 3. 功能详情

### 3.1 知识库管理（FR-KB-001）

#### 3.1.1 知识库列表

| 维度 | 描述 |
|------|------|
| 路径 | `/knowledge-base` |
| 数据 | 知识库名称、描述、文档数、切片数、状态、最后更新时间 |
| 筛选 | 按状态、标签、创建人、所属组织 |
| 操作 | 单击进入详情、编辑、归档、删除、复制 |

#### 3.1.2 创建知识库

| 维度 | 描述 |
|------|------|
| 表单 | 名称、描述、图标、标签、可见范围、嵌入模型、检索策略 |
| 默认配置 | 嵌入模型：`text-embedding-v3`（Qwen），切片策略：500 tokens + 50 overlap |
| 高级选项 | 自定义切片规则、自定义检索权重 |

#### 3.1.3 知识库详情

| 维度 | 描述 |
|------|------|
| 标签页 | 概览、文档管理、检索配置、权限、版本、消费方、监控 |
| 概览 | 关键指标（文档数/切片数/调用次数/命中率） |

### 3.2 文档管理（FR-KB-002）

#### 3.2.1 上传文档

| 维度 | 描述 |
|------|------|
| 支持格式 | PDF、Word（.docx）、Markdown、Excel（.xlsx）、PPT、HTML、TXT |
| 上传方式 | 单文件、批量上传、文件夹拖拽、URL 抓取 |
| 进度 | 解析进度、切片进度、向量化进度实时展示 |
| 失败处理 | 单文件失败不影响其他文件，错误明细可查看 |

#### 3.2.2 文档列表

| 维度 | 描述 |
|------|------|
| 数据 | 文件名、大小、上传人、上传时间、解析状态、切片数 |
| 操作 | 预览（解析后）、重新解析、删除、下载原文件 |

#### 3.2.3 文档预览

| 维度 | 描述 |
|------|------|
| 形态 | 双栏：左侧原文，右侧切片列表 |
| 操作 | 单击切片高亮原文、编辑切片、合并/拆分切片、标注 |

#### 3.2.4 切片审核

| 维度 | 描述 |
|------|------|
| 操作 | 审核通过/驳回、修改切片内容、调整切片边界、添加标签 |
| 工作流 | 待审核 → 已通过 → 已发布 |

### 3.3 检索配置（FR-KB-003）

#### 3.3.1 切片策略

| 策略 | 适用 |
|------|------|
| 固定长度 | 通用文档（默认 500 tokens + 50 overlap） |
| 按段落 | 结构化文档（Markdown、HTML） |
| 按章节 | 长文档（书籍、论文） |
| 自定义规则 | 行业特殊场景（如法务条款、技术规范） |

#### 3.3.2 检索策略

| 维度 | 描述 |
|------|------|
| 向量检索 | Milvus（SAA VectorStore） |
| 关键词检索 | Elasticsearch（BM25） |
| 混合权重 | 默认 7:3（向量:关键词），可调 |
| 重排序 | BGE-reranker-base 或相似模型 |
| Top-K | 默认 10，可调（1-100） |
| 阈值 | 相似度阈值过滤（默认 0.6） |

#### 3.3.3 嵌入模型

| 模型 | 维度 | 适用 |
|------|------|------|
| text-embedding-v3（Qwen） | 1024 | 中文为主（默认） |
| text-embedding-ada-002 | 1536 | 英文为主 |
| BGE-large-zh-v1.5 | 1024 | 中文专用 |
| m3e-large | 1024 | 多语言 |

### 3.4 权限管理（FR-KB-004）

| 角色 | 权限 |
|------|------|
| `KB_ADMIN` | 知识库全部权限（CRUD、权限分配、删除） |
| `KB_EDITOR` | 上传/编辑文档、审核切片 |
| `KB_VIEWER` | 仅查看文档列表与预览 |
| `KB_CONSUMER` | 仅检索（数字员工/Copilot 调用） |

权限继承自 TECH-IAM 角色，可按知识库/文档级别细粒度配置。

### 3.5 版本管理（FR-KB-005）

| 维度 | 描述 |
|------|------|
| 版本类型 | 文档版本（上传替换）、切片版本（重新切片）、索引版本（重建索引） |
| 版本对比 | 切片差异、文档差异、嵌入向量差异 |
| 版本回滚 | 一键回滚到指定版本（数据快照 + 索引快照） |
| 版本清理 | 自动清理 30 天前的旧版本（可配置） |

### 3.6 监控与可观测性（FR-KB-006）

| 指标 | 数据来源 | 用途 |
|------|---------|------|
| 检索调用次数 | TECH-OBS | 使用频次统计 |
| 平均响应时间 | TECH-OBS | 性能监控 |
| 命中率（Top-K 内） | 应用埋点 | 检索质量 |
| 反馈点赞率 | 用户反馈 | 满意度 |
| 文档解析失败率 | TECH-OBS | 解析稳定性 |
| 向量化队列长度 | TECH-MSG | 任务积压监控 |

### 3.7 与下游系统的绑定（FR-KB-007）

> **v1.1 强化（2026-07-22）**：本节明确 COPILOT 不直接绑知识库，而是通过 **A2A 协议调用业务 RAG 知识库数字员工**完成检索。这是 KB 模块的核心消费链路。

#### 3.7.1 绑定矩阵

| 下游系统 | 绑定方式 | 调用入口 | 用途 | 是否核心场景 |
|---------|---------|---------|------|------------|
| **业务 RAG 数字员工（APP-DW）** | 数字员工级别（推荐） | 通过 A2A 协议被 COPILOT 调用 | 业务知识库的统一封装（**核心场景**） | ✅ |
| APP-COPILOT | 间接调用（通过数字员工） | A2A → 数字员工 → KB | COPILOT 通过数字员工间接检索 | ✅（间接） |
| APP-APPHUB | 应用级别 | 应用内 MCP 工具 | 应用内置知识库（FAQ/手册） | 二级 |
| APP-MCPHUB | 通过 MCP 工具暴露 | MCP Protocol | 外部 AI 工具检索知识库 | 二级 |
| APP-DASHBOARD | 仅展示指标 | TECH-OBS | 知识库使用统计 | 辅助 |

#### 3.7.2 业务 RAG 知识库数字员工绑定（核心场景·FR-KB-007-01）

业务 RAG 知识库数字员工是 COPILOT 调用知识库的**唯一标准入口**。每个业务域建议建立一个专属数字员工（如"法务知识库数字员工"、"财务知识库数字员工"）。

**数字员工创建流程**：

| 步骤 | 操作 | 系统行为 |
|------|------|---------|
| 1 | 在 APP-DW 创建数字员工，类型选「业务 RAG 知识库」 | 自动生成 Agent Card 骨架 |
| 2 | 配置数字员工元数据：名称、描述、所属业务域、能力声明 | 元数据写入 `digital_worker` 表 |
| 3 | 绑定知识库：选择 APP-KB 中的 1~N 个知识库 | 在 `dw_kb_binding` 表写入关联 |
| 4 | 配置检索策略：topK、阈值、重排序模型、引用数量 | 写入 `dw_retrieval_config` 表 |
| 5 | 注册到 Nacos A2A Registry | 发布 Agent Card（含 endpoint + 能力清单 + 鉴权方式） |
| 6 | COPILOT 自动发现并可调度 | 进入可被 A2A 调用的状态 |

**Agent Card 关键字段**（基于 A2A 协议规范）：

```json
{
  "name": "legal-knowledge-agent",
  "displayName": "法务知识库数字员工",
  "description": "提供公司法务知识库的检索增强回答，覆盖合同、纠纷、合规等领域",
  "version": "1.0.0",
  "endpoint": "https://mate-dw-service/api/v1/a2a/agents/legal-knowledge-agent",
  "capabilities": [
    "rag.search.legal",
    "rag.cite.legal",
    "rag.multihop.legal"
  ],
  "inputSchema": {
    "query": "string (用户原始问题)",
    "context": "object (对话上下文，可选)",
    "topK": "integer (默认 10)",
    "kbFilters": "object (按知识库筛选)"
  },
  "outputSchema": {
    "chunks": "array<Top-K 段落>",
    "citations": "array<引用溯源>",
    "summary": "string (员工整理的简要回答)"
  },
  "auth": {
    "type": "oauth2",
    "tokenUrl": "https://mate-iam/oauth2/token",
    "scopes": ["dw.invoke"]
  },
  "metadata": {
    "businessDomain": "legal",
    "knowledgeBaseIds": ["kb-legal-001"],
    "ownerOrg": "org-legal-dept"
  }
}
```

**绑定关系管理**：

| 操作 | 说明 | 权限 |
|------|------|------|
| 数字员工绑定知识库 | 在数字员工详情页「知识库」标签页选择 KB | `KB_EDITOR` + 数字员工所有者 |
| 解绑知识库 | 单向解绑（不影响 KB 本体） | 同上 |
| 切换主知识库 | 多 KB 场景下设置"默认检索 KB" | 数字员工所有者 |
| 批量绑定 | 支持 Excel 批量导入 KB ID 列表 | 仅 `KB_ADMIN` |

#### 3.7.3 A2A 调用协议（FR-KB-007-02）

COPILOT 调用业务 RAG 数字员工遵循 **A2A（Agent-to-Agent）协议**，技术实现基于 **Spring AI Alibaba Starter A2A Nacos**。

**调用请求格式**：

```http
POST /api/v1/a2a/agents/{agentId}/invoke HTTP/1.1
Host: mate-dw-service
Authorization: Bearer {OAuth2_token_from_copilot}
X-Trace-Id: {trace_id}
Content-Type: application/json

{
  "task": "rag.search",
  "input": {
    "query": "我们和供应商的违约金条款上限是多少？",
    "context": {
      "userId": "u-12345",
      "sessionId": "s-abcde",
      "previousTurns": [...]
    },
    "topK": 10,
    "kbFilters": {
      "kbIds": ["kb-legal-001"],
      "tags": ["合同范本"]
    }
  },
  "config": {
    "timeoutMs": 5000,
    "streamEnabled": true
  }
}
```

**调用响应格式**：

```http
HTTP/1.1 200 OK
X-Trace-Id: {trace_id}
Content-Type: application/json

{
  "status": "success",
  "output": {
    "chunks": [
      {
        "chunkId": "ch-9876",
        "content": "合同违约金不得超过合同标的额的 30%...",
        "score": 0.92,
        "metadata": {"source": "合同范本-标准采购合同-v3.pdf", "page": 5}
      }
    ],
    "citations": [
      {"kbId": "kb-legal-001", "kbName": "公司法务知识库", "docName": "合同范本-标准采购合同-v3.pdf"}
    ],
    "summary": "根据公司法务知识库检索，违约金上限为合同标的额的 30%。"
  },
  "metrics": {
    "latencyMs": 320,
    "kbCalls": 1,
    "chunksRetrieved": 10,
    "chunksAfterRerank": 5
  }
}
```

**调用流程关键点**：

| 环节 | 行为 | 备注 |
|------|------|------|
| 服务发现 | COPILOT 通过 Nacos A2A Registry 查询 Agent Card | 缓存 60s |
| 鉴权 | OAuth2 Bearer Token 透传 + 数字员工侧 IAM 校验 | traceId 关联 |
| 请求路由 | 通过 Spring AI Alibaba A2A Nacos 路由到目标数字员工 | 长任务走异步队列 |
| 检索执行 | 数字员工调用 TECH-RAG，TECH-RAG 调用本 KB API | KB 不感知 A2A |
| 引用溯源 | 每条 chunk 携带 source、page、kbId | 用于 COPILOT 回答引用 |
| 流式响应 | 大结果集支持 SSE 流式回传 | 默认开启 |
| 失败处理 | 数字员工内部重试 2 次 → 失败返回错误码 + 建议 | 跨员工降级到 KB 直连 |
| 审计日志 | 完整记录 traceId + 调用方 + 数字员工 + 检索参数 | TECH-OBS |

#### 3.7.4 跨域协同调用（FR-KB-007-03）

跨业务域问题（如"差旅中受伤算不算工伤？"）需要 COPILOT 并行调度多个数字员工：

```
COPILOT
  ├─ A2A → 法务知识库数字员工  → 检索"差旅""工伤"相关法务条款
  ├─ A2A → HR 知识库数字员工    → 检索"工伤认定""劳动法"相关 HR 制度
  └─ LLM 综合两路结果，生成统一回答
```

**协同约束**：

| 约束 | 说明 |
|------|------|
| 超时 | 单路最长 5s，总协同最长 10s |
| 失败隔离 | 任一路失败不影响其他路 |
| 结果去重 | 跨路相同引用合并 |
| 来源标识 | 回答中明确每条引用的业务域 |

#### 3.7.5 数字员工对 KB 的依赖接口

业务 RAG 数字员工调用 KB 的核心接口（KB 侧需稳定暴露）：

| 接口 | 用途 | 备注 |
|------|------|------|
| `POST /api/v1/knowledge-base/search` | 单 KB 检索 | 主要接口 |
| `POST /api/v1/knowledge-base/search/stream` | 流式检索 | 大结果集 |
| `GET /api/v1/knowledge-base/{kbId}` | 获取 KB 元数据 | 校验权限 + 获取检索配置 |
| `POST /api/v1/knowledge-base/{kbId}/search/feedback` | 检索反馈 | 用于效果优化 |

> **v1.1 设计原则**：KB API 对数字员工保持"无 A2A 感知"，数字员工侧负责 A2A 封装。这样 KB 模块可独立演进，不被协议升级绑死。

---

## 4. 增量交付计划

### Phase 1：知识库基础（MVP 核心，4 周）

| 任务 | 范围 | 优先级 |
|------|------|--------|
| 知识库 CRUD | 创建、列表、详情、归档 | P0 |
| 文档上传与解析 | PDF/Word/Markdown | P0 |
| 基础切片 | 固定长度策略 | P0 |
| 向量索引 | Milvus 接入 | P0 |
| 基础检索 | 向量检索 + Top-K | P0 |

### Phase 2：检索增强（3 周）

| 任务 | 范围 | 优先级 |
|------|------|--------|
| 混合检索 | 向量 + BM25 | P0 |
| 重排序 | BGE-reranker | P0 |
| 多嵌入模型 | 支持切换 | P1 |
| 切片策略扩展 | 段落/章节 | P1 |

### Phase 3：运营能力（3 周）

| 任务 | 范围 | 优先级 |
|------|------|--------|
| 切片审核工作流 | 待审核/通过/驳回 | P0 |
| 版本管理 | 文档/切片/索引快照 | P0 |
| 权限细粒度 | 文档级别权限 | P1 |
| 监控大盘 | 使用指标看板 | P1 |

### Phase 4：消费方集成（2 周）

| 任务 | 范围 | 优先级 |
|------|------|--------|
| APP-COPILOT 集成 | 全局知识库绑定 | P0 |
| APP-DW 集成 | 数字员工绑定 | P0 |
| APP-APPHUB 集成 | 应用内置知识库 | P1 |
| MCP 工具暴露 | 外部检索工具 | P1 |

### Phase 5：高级功能（持续）

| 任务 | 范围 | 优先级 |
|------|------|--------|
| URL 抓取 | 网页内容自动入库 | P2 |
| 增量更新 | 文档变更自动更新索引 | P2 |
| 多模态 | 图片/表格内容识别 | P2 |
| 跨语言检索 | 中英文混合检索 | P2 |

---

## 5. 依赖关系

### 5.1 上游依赖

| 依赖服务 | 依赖内容 | 依赖类型 |
|----------|----------|----------|
| TECH-RAG | 文档解析、嵌入模型、向量检索、混合检索、重排序 | 强依赖 |
| TECH-ONT | 概念引用（切片可关联到 Ontology 概念） | 中等依赖 |
| TECH-DATA | 大文档存储、解析中间结果存储 | 强依赖 |
| TECH-IAM | 用户、角色、权限 | 强依赖 |
| TECH-MSG | 异步任务（解析/向量化）消息 | 强依赖 |
| TECH-OBS | 监控指标、审计日志 | 强依赖 |
| TECH-GW | API 网关、限流、鉴权 | 强依赖 |

### 5.2 下游消费方

| 消费方 | 消费内容 |
|--------|----------|
| APP-COPILOT | RAG 检索增强回答 |
| APP-DW | 数字员工绑定知识库 |
| APP-APPHUB | 应用内置 FAQ/手册 |
| APP-MCPHUB | 通过 MCP 暴露外部检索 |
| APP-DASHBOARD | 知识库使用统计指标 |

### 5.3 与相关模块的边界

| 模块 | 关系 |
|------|------|
| APP-ONTSTUDIO | **解耦**：APP-KB 关注内容，APP-ONTSTUDIO 关注语义；通过 TECH-ONT/TECH-RAG 协同 |
| TECH-RAG | APP-KB 是 TECH-RAG 的**业务封装**与**内容管理层**，提供 UI 与业务编排 |
| TECH-LLMGW | 通过 TECH-RAG 间接使用，APP-KB 不直接调用 LLM |

### 5.4 交互流程

```
用户上传文档 → APP-KB 前端
  ↓
文档解析 → TECH-DATA（MinIO 存储原文件）
  ↓
切片处理 → TECH-RAG（DocumentReader + Splitter）
  ↓
向量化 → TECH-RAG（Embedding + Milvus VectorStore）
  ↓
索引构建完成 → 状态变为"已发布"
  ↓
检索调用 → TECH-RAG → APP-KB API 返回结果
  ↓
所有操作日志 → TECH-OBS
```

---

## 6. API 接口概要

### 6.1 知识库管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/v1/knowledge-base` | 知识库列表 |
| POST | `/api/v1/knowledge-base` | 创建知识库 |
| GET | `/api/v1/knowledge-base/{kbId}` | 知识库详情 |
| PUT | `/api/v1/knowledge-base/{kbId}` | 更新知识库 |
| DELETE | `/api/v1/knowledge-base/{kbId}` | 删除知识库 |
| POST | `/api/v1/knowledge-base/{kbId}/archive` | 归档 |

### 6.2 文档管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/v1/knowledge-base/{kbId}/documents` | 文档列表 |
| POST | `/api/v1/knowledge-base/{kbId}/documents` | 上传文档（multipart） |
| GET | `/api/v1/knowledge-base/{kbId}/documents/{docId}` | 文档详情 |
| DELETE | `/api/v1/knowledge-base/{kbId}/documents/{docId}` | 删除文档 |
| POST | `/api/v1/knowledge-base/{kbId}/documents/{docId}/reparse` | 重新解析 |
| GET | `/api/v1/knowledge-base/{kbId}/documents/{docId}/chunks` | 切片列表 |
| PUT | `/api/v1/knowledge-base/{kbId}/chunks/{chunkId}` | 更新切片 |
| POST | `/api/v1/knowledge-base/{kbId}/chunks/{chunkId}/approve` | 审核通过 |
| POST | `/api/v1/knowledge-base/{kbId}/chunks/{chunkId}/reject` | 审核驳回 |

### 6.3 检索接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/v1/knowledge-base/{kbId}/search` | 单知识库检索 |
| POST | `/api/v1/knowledge-base/search` | 跨知识库检索（需要多 kb 权限） |
| POST | `/api/v1/knowledge-base/{kbId}/search/stream` | 流式检索（SSE） |
| POST | `/api/v1/knowledge-base/{kbId}/search/feedback` | 检索结果反馈 |

### 6.4 权限与版本

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/v1/knowledge-base/{kbId}/permissions` | 权限列表 |
| POST | `/api/v1/knowledge-base/{kbId}/permissions` | 分配权限 |
| GET | `/api/v1/knowledge-base/{kbId}/versions` | 版本列表 |
| POST | `/api/v1/knowledge-base/{kbId}/versions` | 创建版本快照 |
| POST | `/api/v1/knowledge-base/{kbId}/versions/{versionId}/rollback` | 回滚版本 |
| GET | `/api/v1/knowledge-base/{kbId}/versions/{versionId}/diff` | 版本对比 |

### 6.5 监控

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/v1/knowledge-base/{kbId}/metrics` | 使用指标 |
| GET | `/api/v1/knowledge-base/{kbId}/metrics/usage` | 使用详情 |
| GET | `/api/v1/knowledge-base/{kbId}/consumers` | 消费方列表 |

---

## 7. 数据模型概要

### 7.1 核心实体

```
KnowledgeBase（知识库）
├── id: UUID (PK)
├── name: String
├── description: Text
├── icon: String
├── tags: JSON
├── visibility: Enum [PRIVATE, ORG, PUBLIC]
├── ownerId: String (FK -> User.id)
├── orgId: String (FK -> Org.id)
├── embeddingModel: String  // text-embedding-v3 等
├── chunkStrategy: Enum [FIXED, PARAGRAPH, SECTION, CUSTOM]
├── chunkConfig: JSON  // {chunkSize, overlap, ...}
├── retrievalConfig: JSON  // {vectorWeight, bm25Weight, topK, threshold, reranker}
├── status: Enum [ACTIVE, ARCHIVED, BUILDING, FAILED]
├── documentCount: Integer
├── chunkCount: Integer
├── createdAt: Timestamp
├── updatedAt: Timestamp
└── lastIndexedAt: Timestamp

Document（文档）
├── id: UUID (PK)
├── kbId: String (FK -> KnowledgeBase.id)
├── name: String
├── fileType: String  // pdf, docx, md, xlsx...
├── fileSize: Long
├── fileUrl: String  // MinIO 路径
├── parseStatus: Enum [PENDING, PARSING, PARSED, FAILED]
├── parseError: Text
├── chunkCount: Integer
├── uploaderId: String
├── approvalStatus: Enum [PENDING, APPROVED, REJECTED]
├── metadata: JSON
├── createdAt: Timestamp
└── updatedAt: Timestamp

DocumentChunk（切片）
├── id: UUID (PK)
├── docId: String (FK -> Document.id)
├── kbId: String (FK -> KnowledgeBase.id)
├── chunkIndex: Integer
├── content: Text
├── contentVector: Vector(1024)  // Milvus 向量
├── tokenCount: Integer
├── metadata: JSON  // 章节、页码、坐标
├── approvalStatus: Enum [PENDING, APPROVED, REJECTED]
├── tags: JSON
├── conceptRefs: JSON  // 关联到 Ontology 概念
├── createdAt: Timestamp
└── updatedAt: Timestamp

KbPermission（知识库权限）
├── id: UUID (PK)
├── kbId: String (FK -> KnowledgeBase.id)
├── principalType: Enum [USER, ROLE, ORG]
├── principalId: String
├── role: Enum [ADMIN, EDITOR, VIEWER, CONSUMER]
├── grantedBy: String
├── createdAt: Timestamp
└── expiresAt: Timestamp

KbVersion（知识库版本）
├── id: UUID (PK)
├── kbId: String (FK -> KnowledgeBase.id)
├── versionNumber: String
├── snapshotType: Enum [DOCUMENT, CHUNK, INDEX]
├── snapshotData: JSON  // 快照元数据
├── indexSnapshotId: String  // Milvus 集合快照
├── createdBy: String
├── createdAt: Timestamp
└── description: String

SearchLog（检索日志）
├── id: UUID (PK)
├── kbId: String
├── userId: String
├── query: Text
├── topK: Integer
├── resultCount: Integer
├── topScore: Float
├── latencyMs: Integer
├── consumerType: String  // COPILOT, DW, APPHUB, MCP
├── consumerId: String
├── feedback: Enum [NONE, LIKE, DISLIKE]
├── createdAt: Timestamp
└── traceId: String
```

### 7.2 数据库表映射

| 实体 | 数据库表 | 说明 |
|------|---------|------|
| KnowledgeBase | `kb_knowledge_bases` | 知识库主表 |
| Document | `kb_documents` | 文档表 |
| DocumentChunk | `kb_document_chunks` | 切片表（PostgreSQL，元数据） |
| DocumentChunk | Milvus Collection `kb_chunks` | 切片向量表 |
| KbPermission | `kb_permissions` | 权限表 |
| KbVersion | `kb_versions` | 版本表 |
| SearchLog | `kb_search_logs` | 检索日志 |

---

## 8. 非功能需求

### 8.1 性能需求

| 指标 | 要求 |
|------|------|
| 单次检索响应 | P95 < 800ms |
| 文档解析吞吐 | ≥ 100 文档/分钟（10MB PDF） |
| 向量化吞吐 | ≥ 1000 chunks/分钟 |
| 并发检索 | 支持 200 QPS |
| 大文档支持 | 单文档 ≤ 500MB |
| 知识库规模 | 单知识库 ≤ 100 万切片 |

### 8.2 可用性需求

| 指标 | 要求 |
|------|------|
| 服务可用性 | 99.9% |
| 异步任务可靠性 | 失败重试 3 次 + DLQ |
| 索引一致性 | 文档删除 5s 内从索引中移除 |
| 检索降级 | 向量检索失败时降级到 BM25 |

### 8.3 安全需求

- 所有 API 经 TECH-IAM OAuth2 鉴权
- 知识库可见范围严格按权限控制（PRIVATE/ORG/PUBLIC）
- 文档原文件存储在 MinIO，启用服务端加密
- 切片内容敏感信息脱敏（身份证、手机号、银行卡）
- 检索日志完整审计（含 traceId）

### 8.4 AI 质量需求

| 指标 | 要求 |
|------|------|
| 检索准确率（Hit@5） | > 85% |
| 引用溯源覆盖率 | 100% |
| 反馈点赞率 | > 70% |
| 文档解析成功率 | > 99% |

### 8.5 可扩展性

- 支持嵌入模型热切换（不重建索引需向量维度一致）
- 支持自定义切片规则（SPI 扩展）
- 支持自定义检索重排序策略
- 支持知识库联邦检索（跨知识库聚合）

---

## 9. 上下游依赖关系

### 9.1 数据流转

```
用户上传文档 → APP-KB 前端
  ↓
文档存储 → MinIO（TECH-DATA）
  ↓
异步任务 → Kafka（TECH-MSG）
  ↓
文档解析服务 → TECH-RAG DocumentReader
  ↓
切片 → TECH-RAG Splitter
  ↓
向量化 → TECH-RAG Embedding → Milvus
  ↓
索引更新 → TECH-RAG VectorStore
  ↓
检索请求 → APP-KB API → TECH-RAG 混合检索 → 重排序 → Top-K
  ↓
检索日志 → PostgreSQL + TECH-OBS
```

### 9.2 跨服务依赖图

```
APP-KB
  ├─→ TECH-RAG（强）       检索、解析、嵌入
  ├─→ TECH-DATA（强）      文档存储、向量存储
  ├─→ TECH-MSG（强）       异步任务消息
  ├─→ TECH-IAM（强）       鉴权与权限
  ├─→ TECH-OBS（中）       监控与审计
  ├─→ TECH-ONT（中）       概念关联（可选）
  └─→ TECH-GW（强）        API 网关

下游：
  ├─→ APP-COPILOT（RAG 检索）
  ├─→ APP-DW（数字员工绑定）
  ├─→ APP-APPHUB（应用知识库）
  └─→ APP-MCPHUB（外部工具）
```

---

## 附录 A：UI 设计基线

> 数据来源：`metaplatform-design-draft/` 设计库（MetaPlatform3.0）

| 维度 | 取值 |
|------|------|
| 设计库 | MetaPlatform3.0（id: `_-ZRH2U5YKIYA4`） |
| 设备类型 | Desktop |
| 主题 | Dark theme |
| 颜色 token | `--background:#0a0a0a`、`--card:#111111`、`--border:#262626`、`--primary:#fafafa`、`--success:#62d178`、`--destructive:#ff6166`、`--warning:#eab308` |
| 字体 | Geist（`--font-sans:'Geist',ui-sans-serif,system-ui,sans-serif`） |
| 形状 | `--radius:8px`，1px 边框，零阴影 |
| 组件前缀 | `.v-card`、`.v-btn`、`.v-btn-primary`、`.v-table`、`.v-input`、`.v-tab`、`.v-badge-*`、`.v-sidebar-item` |
| 深度分层 | `#0a0a0a > #111111 > #1a1a1a`（纯背景色差，无阴影） |

### A.1 对应设计稿页面

| 设计稿页面 | URL | PRD 章节 |
|----------|-----|---------|
| 知识库主页 | `metaplatform-design-draft/pages/ontology-knowledgebase.html` | 3.1 ~ 3.7（全部） |

> **设计稿覆盖说明**：当前设计稿仅包含知识库主页（1 页），未包含详情/上传/检索配置等子页面。本 PRD 基于主页页面元素推演完整的子页面结构，待 v1.1 设计稿补全后更新。

---

## 附录 B：v1.0 变更说明

本文件为 **APP-KB 模块的首版 PRD（v1.0）**，无前一版本变更记录。后续版本变更将登记在版本历史表。

### B.1 命名与归属

| 项 | 取值 |
|----|------|
| 模块标识 | APP-KB |
| 模块中文名 | 知识库 |
| 目录 | `docs/prd/APP-KB/` |
| 包名（待 R3 阶段确认） | `com.metaplatform.kb.*` |
| 前端 monorepo 路径 | `metaplatform-frontend/apps/kb/`（待建） |
| 顶部导航 | `nav-knowledge` |
| 设计稿分组 | group 5 |

### B.2 与 APP-ONTSTUDIO 拆分原因

- 设计稿将 `ontology-knowledgebase.html` 标记为独立 group（group 5），从 APP-ONTSTUDIO（group 4）分离
- 知识库关注"内容资产"（文档/向量），本体论关注"语义建模"（概念/关系），二者职责不同
- 拆分后 APP-ONTSTUDIO 专注于语义层，APP-KB 专注于内容层
- 通过 TECH-RAG 与 TECH-ONT 解耦，避免重复实现

### B.3 后续规划

| 阶段 | 状态 | 内容 |
|------|------|------|
| R0 仓库精简 | ✅ 完成 | APP-KB 目录已创建，PRD v1.0 已就绪 |
| R1 基础设施 | 🟡 进行中 | monorepo 中 `apps/kb/` 前端骨架待建 |
| R2 服务骨架 | [ ] | TECH-RAG 收敛，APP-KB 服务骨架搭建 |
| R3 核心实现 | [ ] | Phase 1（MVP）开发 |
| R4 消费方集成 | [ ] | APP-COPILOT/APP-DW 集成 |
| R5 生产化 | [ ] | 监控大盘、权限细粒度、跨语言检索 |

---

**PRD 版本**: v1.0
**PRD 日期**: 2026-07-22
**刷新依据**: `docs/prd/_top/REPORT-设计稿与PRD差异分析_v1.0-20260722.md`
**关联 PRD**:
- `docs/prd/_top/REPORT-设计稿与PRD差异分析_v1.0-20260722.md`（设计稿差异分析）
- `docs/prd/APP-ONTSTUDIO/PRD-APP-ONTSTUDIO-本体论引擎_v2.0-20260722.md`（语义建模侧）
- `docs/prd/APP-COPILOT/PRD-APP-COPILOT-通用_v2.0-20260722.md`（RAG 消费方）
---

## 附录 C：v1.1 变更说明（A2A 强化，2026-07-22）

> **触发原因**：基于平台设计复核，明确核心场景为"COPILOT 通过 A2A 协议调用业务 RAG 知识库数字员工"，而非 COPILOT 直接检索知识库。原 v1.0 描述中"COPILOT 直接绑知识库"的说法不准确。

### C.1 核心变更点

| 维度 | v1.0 描述 | v1.1 强化 | 理由 |
|------|---------|---------|------|
| 检索主体 | COPILOT 直接调用 KB | COPILOT 通过 A2A 调用**业务 RAG 知识库数字员工**，由数字员工调用 KB | 知识库是"资产"，数字员工是"封装者"，COPILOT 是"调度者"，三者解耦 |
| 协议 | REST 直连 | **A2A 协议**（Spring AI Alibaba A2A Nacos） | 数字员工是 Agent，遵循 Agent 间标准协议 |
| 服务发现 | 静态配置 | **Nacos A2A Registry** 动态发现 | 数字员工增减不影响 COPILOT 配置 |
| 跨域问题 | COPILOT 自行处理 | **多数字员工并行 + LLM 汇总** | 跨业务域问题天然适合 Agent 协同 |
| 权限模型 | COPILOT 直接拿 KB 权限 | **OAuth2 Token 透传 + 数字员工侧 IAM 校验** | 权限在数字员工层收敛 |
| 审计追踪 | KB 侧单一 traceId | **A2A traceId + KB traceId 关联** | 跨服务全链路追踪 |

### C.2 新增章节

- 2.2 场景 0（核心场景）：COPILOT → A2A → 业务 RAG 数字员工 → KB 完整链路
- 2.2 场景 3：跨域协同（法务 + HR）
- 3.7.1 绑定矩阵（明确"业务 RAG 数字员工"是核心入口）
- 3.7.2 业务 RAG 知识库数字员工绑定（FR-KB-007-01）+ Agent Card 规范
- 3.7.3 A2A 调用协议（FR-KB-007-02）+ HTTP 请求/响应规范
- 3.7.4 跨域协同调用（FR-KB-007-03）
- 3.7.5 数字员工对 KB 的依赖接口

### C.3 受影响 PRD（同步更新）

| PRD | 同步内容 |
|-----|---------|
| `docs/prd/APP-COPILOT/PRD-APP-COPILOT-通用_v2.0-20260722.md` | 1.2 核心价值 + 2.4 任务编排 + 7.1 上游依赖：补充 A2A 调度业务 RAG 数字员工 |
| `docs/prd/APP-COPILOT/PRD-APP-COPILOT-超级AI_v1.0-20260716.md` | 实现状态盘点：FR-AI-006 任务编排补充 A2A 调用 |
| `docs/prd/APP-DW/PRD-APP-DW-数字员工_v1.0-20260716.md` | 3.1 员工管理 + 3.2 能力配置：补充"业务 RAG 知识库数字员工"角色 |

### C.4 路线图影响

| 阶段 | 状态 | 影响 |
|------|------|------|
| R1 基础设施 | 进行中 | 无（基础设施层） |
| R2 服务骨架 | 待启动 | **新增**：需在骨架阶段预留 A2A 调用点 |
| R3 核心实现 | 待启动 | **强化**：业务 RAG 知识库数字员工是 P0 模块 |
| R4 协议层 | 待启动 | A2A 协议实现是 R4 核心，与 MCP 并列 |
| R5 生产化 | 待启动 | A2A 调用稳定性 + 跨域协同效果 |

### C.5 风险与缓解

| 风险 | 等级 | 缓解 |
|------|------|------|
| A2A 协议实现复杂度 | 中 | 基于 Spring AI Alibaba Starter A2A Nacos 已有封装 |
| 数字员工数量膨胀导致调用链长 | 中 | 限制单次请求最多 5 个数字员工 |
| KB 不感知 A2A 导致观测盲区 | 低 | 在 TECH-OBS 增加 A2A 调用埋点 |
| 跨域协同结果质量不稳定 | 中 | LLM 汇总时附带"业务域标签"，便于用户理解 |

---

**PRD 版本**: v1.1（A2A 强化）
**PRD 日期**: 2026-07-22
**关联文档**: 
- `docs/prd/_top/REPORT-设计稿与PRD差异分析_v1.0-20260722.md`
- `docs/prd/APP-COPILOT/PRD-APP-COPILOT-通用_v2.0-20260722.md`（同步更新）
- `docs/prd/APP-DW/PRD-APP-DW-数字员工_v1.0-20260716.md`（同步更新）
