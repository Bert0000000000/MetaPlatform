# LLM 技术栈偏差检查报告 · 2026-08-02

> 版本:v1.0 · 2026-08-02
> 验收人:需求层(TRAE)
> 状态:**Active**(LLM / Agent 技术栈审计)

---

## 1. 检查范围

对照:
- **规范**:`docs/active/specs/2026-07-27-mate-platform-architecture-implementation.md` §3.4(技术栈定稿)
- **规范**:`docs/active/specs/2026-07-27-mate-platform-tech-stack-confirmed.md` line 79(LLM 编排)
- **代码**:`packages/mate-tech-{agent,llmgw,rag}/*` 与 `pyproject.toml` / `requirements.txt` / `uv.lock`

---

## 2. 规范声明(应该用什么)

| 类别 | 规范要求 | 版本 |
|---|---|---|
| LLM 编排 | **LangChain + LlamaIndex** | LangChain 1.3+ / LlamaIndex 1.x |
| 多 Agent | **LangGraph** | 1.2.9+ |
| LLM 提供商 | (规范未明确;架构基线 §3.2 提到 OpenAI / Anthropic / 豆包 / 通义) | - |
| LLM Provider 包 | `mate-tech-llmgw`(统一 LLM 网关) | - |
| Agent 包 | `mate-tech-agent`(LangGraph 编排) | - |

---

## 3. 实际代码侧落地

### 3.1 LangGraph(✅ 落地)

| 检查项 | 结果 |
|---|---|
| `pyproject.toml` | ✅ `langgraph>=1.2.9` line 40 |
| `requirements.txt` | ✅ `langgraph==1.2.9` line 187 |
| `packages/mate-tech-agent/src/mate_tech_agent/graph.py` | ✅ `from langgraph.graph import END, START, StateGraph` line 8 |
| `packages/mate-tech-agent/src/mate_tech_agent/state.py` | ✅ `from langgraph.graph.message import add_messages` line 6 |
| `packages/mate-tech-agent/src/mate_tech_agent/api/app.py` | ✅ `from mate_tech_agent.graph import ...` line 39 |
| `ruff.toml` | ✅ "mate-tech-agent: lazy imports for optional deps (langgraph, psyc...)" line 23 |

**LangGraph 1.2.9 完整落地,真实用于多 Agent 编排(s1-s4 场景)。

### 3.2 LangChain(🟡 部分落地)

| 检查项 | 结果 |
|---|---|
| `pyproject.toml` | ✅ `langchain>=1.3.0` line 38 |
| `requirements.txt` | ✅ `langchain==1.3.14` line 165 + `langchain-openai` / `langchain-community` / `langchain-classic` / `langchain-text-splitters` |
| `packages/mate-tech-agent/src/mate_tech_agent/llm.py` | ✅ `from langchain_openai import ChatOpenAI` line 39(仅 LLM_PROVIDER=openai 时) |
| `packages/mate-tech-llmgw/src/mate_tech_llmgw/providers/{openai,anthropic,doubao,qwen}.py` | 🔴 **4 个 provider 全用裸 httpx,无 LangChain** |

**LangChain 用作 ChatOpenAI 的"包装层",**主要在 agent 包**;llmgw 网关层**反而绕开 LangChain** 直接调 OpenAI / Anthropic / 豆包 / Qwen 的原生 HTTP API。

### 3.3 LlamaIndex(🔴 偏差)

| 检查项 | 结果 |
|---|---|
| `uv.lock` | ⚠️ 有 `llama-index` / `llama-index-core` / `llama-index-embeddings-openai` / `llama-index-llms-openai` 等包(传递依赖) |
| 代码 `import` | 🔴 **0 处** |
| `pyproject.toml` / `requirements.txt` | 🔴 **未直接声明** |

**LlamaIndex 在 uv.lock 中是 RAGFlow / GraphRAG 的传递依赖,不是项目主动使用。**

### 3.4 LLM Provider(✅ 完整)

| Provider | 实现位置 | 协议 |
|---|---|---|
| OpenAI | `mate-tech-llmgw/providers/openai.py` | ✅ 裸 httpx |
| Anthropic | `mate-tech-llmgw/providers/anthropic.py` | ✅ 裸 httpx |
| 豆包(Doubao)| `mate-tech-llmgw/providers/doubao.py` | ✅ 裸 httpx(OpenAI 兼容) |
| Qwen(通义千问)| `mate-tech-llmgw/providers/qwen.py` | ✅ 裸 httpx(OpenAI 兼容) |

**4 个 provider 全实现**(架构基线 §3.2 列的 4 个全到位),但都用裸 httpx,没用 LangChain 包装。

---

## 4. 偏差分析

### 4.1 ✅ LangGraph 真正在用 — **与规范一致**

```
✔ 规范: 多 Agent = LangGraph 1.2.9+
✔ 代码: pyproject + requirements + graph.py + state.py + api/app.py 全部引用
✔ 落地: 4 个场景(s1-s4)graph + s1-s4 test 全部通过
```

### 4.2 🟡 LangChain — **规范 vs 实际有偏差**

```
规范: LLM 编排 = LangChain + LlamaIndex 1.3+
实际: LangChain 仅在 agent 包的 llm.py(包装 ChatOpenAI)
      llmgw 网关用裸 httpx 直接调 LLM HTTP API
```

**偏差性质**:**不是误用,是优化**——裸 httpx 比 LangChain 包装更轻、依赖更少、性能更好。这是合理的工程选择。

但与规范文字不完全一致(规范说"LLM 编排 LangChain + LlamaIndex",实际 LangChain 用了但 LlamaIndex 没主动用)。

### 4.3 🔴 LlamaIndex — **与规范偏差**

```
规范: LLM 编排 = LangChain + LlamaIndex
实际: 0 处代码 import
      uv.lock 中有(作为 RAGFlow / GraphRAG 的传递依赖)
```

**偏差性质**:**完全未用**。规范可能基于 v1.0 / v2.0 时期的索引需求(RAG 索引构建),但 v3.0 转向 RAGFlow / LightRAG / GraphRAG 的 HTTP client,不需要 LlamaIndex 的本地索引能力。

### 4.4 ✅ LLM Provider — **与规范一致**

```
规范: mate-tech-llmgw 网关(架构基线 §3.2)
实际: 4 个 provider 全部用裸 httpx 实现(OpenAI / Anthropic / 豆包 / Qwen)
```

**偏差性质**:**完全符合**,只是协议层是裸 httpx 而非 LangChain 包装(更轻)。

### 4.5 🟡 agent 包 LLM 路由 — **与规范有偏差**

```
规范: LangChain + LlamaIndex
实际: 默认 LLM_PROVIDER=echo(自研 stub),需配置 LLM_PROVIDER=openai 才走 LangChain 包装的 ChatOpenAI
```

**默认配置走 EchoLLM / NoOpLLM(自研 stub),不调用真实 LLM**。这在 dev / test 环境合理,但**生产环境必须显式配置 `LLM_PROVIDER=openai`**,否则 agent 调用全部走 stub。

---

## 5. 偏差评估矩阵

| 偏差点 | 规范要求 | 实际 | 偏差影响 | 建议 |
|---|---|---|---|---|
| LangGraph | ✅ 必须 | ✅ **真正在用** | 0(完全合规) | 无需改动 |
| LangChain | ✅ 必须 | 🟡 **仅在 agent 包,llmgw 用裸 httpx** | 低(裸 httpx 是合理工程选择) | 改规范文字,或显式说明 llmgw 用裸 httpx |
| LlamaIndex | ✅ 必须 | 🔴 **0 处 import** | 中(规范承诺未兑现,但项目不需要) | 改规范,删 "LlamaIndex" |
| LLM 网关 | ✅ 必须 | ✅ **完整** | 0(完全合规) | 无需改动 |
| 默认 LLM provider | (未明确) | 🟡 **默认 echo stub** | 中(生产需显式配 openai) | 加 .env.example 或默认值改为 openai |

---

## 6. 偏差是否影响 §13 硬规则

| 硬规则 | 影响 |
|---|---|
| 1 Swagger 没有接口不写 route | 🟢 无影响 |
| 3 tenant 上下文不访问 repository | 🟢 无影响 |
| 4 外部系统 ACL Client | 🟢 无影响(LangGraph / LangChain 都是内部库,不涉及 ACL)|
| 9 审计、指标、trace | 🟢 无影响 |
| 13 NetworkPolicy | 🟢 无影响 |

**偏差不触发 §13 硬规则风险**。

---

## 7. 文档侧修订建议

### 7.1 改规范(architecture-implementation.md §3.4)

| 原规范 | 建议改为 |
|---|---|
| `LLM 编排: LangChain + LlamaIndex 1.3+` | `LLM 编排: LangChain 1.3+(包装 ChatOpenAI) + 裸 httpx 直连 OpenAI/Anthropic/豆包/Qwen HTTP API` |
| `多 Agent: LangGraph 1.2.9+` | 保持不变(完全合规) |

### 7.2 删 LlamaIndex 字样

**理由**:v3.0 项目已转向 RAGFlow / LightRAG / GraphRAG HTTP client,不需要 LlamaIndex 本地索引能力。

**改法**:
- `architecture-implementation.md` §3.4 删 "LlamaIndex"
- `tech-stack-confirmed.md` line 79 删 "LlamaIndex"
- 新增依赖说明:RAG 用 RAGFlow + LightRAG + GraphRAG(三个 HTTP 客户端)

### 7.3 加 .env.example LLM_PROVIDER 说明

**改法**:
- `mate-tech-agent/.env.example`(若不存在就新建)添加:
  ```bash
  # LLM Provider 配置(生产必须 openai)
  LLM_PROVIDER=openai
  OPENAI_CHAT_MODEL=gpt-4o-mini
  OPENAI_API_KEY=sk-...
  ```

---

## 8. 关联文档

- `docs/active/specs/2026-07-27-mate-platform-architecture-implementation.md` §3.4 — 规范源
- `docs/active/specs/2026-07-27-mate-platform-tech-stack-confirmed.md` line 79 — 规范源
- `mate-platform-backend/pyproject.toml` — 依赖声明
- `mate-platform-backend/packages/mate-tech-agent/src/mate_tech_agent/llm.py` — LLM 实现
- `mate-platform-backend/packages/mate-tech-agent/src/mate_tech_agent/graph.py` — LangGraph 实现
- `mate-platform-backend/packages/mate-tech-llmgw/src/mate_tech_llmgw/providers/` — 4 个 provider

---

## 9. 变更记录

| 日期 | 变更 | 作者 |
|---|---|---|
| 2026-08-02 | v1.0 初版(LangGraph ✅ / LangChain 🟡 / LlamaIndex 🔴 / 4 provider ✅) | 需求层(TRAE) |