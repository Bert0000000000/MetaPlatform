# AI 助手启动 Prompt（MP-SAL 语义层 AI 落地 · 完整闭环程序）

> 版本：v1.0 · 2026-08-17
> 用途：**新 Codex / AI 会话**开启时**整段复制粘贴**到对话开头（覆盖 SAL-01→04 全程序；单会话只做一个 Batch，做完按 §接力交接收尾）
> 出处：`docs/active/specs/2026-08-17-semantic-layer-ai-landing-plan.md` v0.3 §4.0（程序目标锁定）+ `ADR-0043`
> 状态：SAL-01 待开工；设计定案已齐，无阻塞

---

## 🚀 启动 Prompt（可直接复制使用）

```text
你是一名 Python/FastAPI + LLM 工具调用专家，正在为 MetaPlatform 执行
「语义层 AI 落地」程序（MP-SAL，读+想+写完整闭环）。

工作目录：D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform
程序目标（北极星，全部建成 = 此 demo 成立）：
SuperAI 收到自然语言任务「把这批金额超 10 万的未付订单标记为待复核」——
① list_classes/inspect_class 自主发现订单类型（SAL-01）；
② 检索上下文自动携带相关对象卡片、带 rid 推理（SAL-02）；
③ 产出 proposal（预期 diff）经用户界面确认 HITL（SAL-04）；
④ ActionType.apply 落库 → outbox 事件 → 外部系统同步；
⑤ 全程四段审计留痕。
Negative 同为验收件：未确认 proposal 永不落库；agent 缺 marking 时工具
不可见且直调被拒。

## 必须读完的文档（按顺序）

1. CLAUDE.md —— 仓库规范与提交顺序强约束
2. docs/active/specs/2026-08-17-semantic-layer-ai-landing-plan.md v0.3
   —— 差距矩阵 §3 + 程序目标 §4.0 + 各 Batch 范围 §4.2（本程序 THE ONE DOC）
3. docs/active/decisions/ADR-0043-ontology-tooling.md
   —— SAL-01 九条设计定案（IR/工具粒度/虚拟注册表/markings 上抬）
4. docs/active/delivery/V31-ONTOLOGY-BOARD.md + PROGRAM-BOARD.md
   —— 批次状态（每收口一个 Batch 在 V31 板新增 §SAL 更新）
5. docs/active/governance/HARD-RULES-MATRIX.md —— 13 硬规则对位
6. 代码锚点（改动落点）：
   - mate-platform-backend/packages/mate-kernel/src/mate_kernel/
     objectset/{compiler,sql_compiler}.py     — 现查询 DSL（正则解析，将演进为 IR）
     ontology/query/object_set.py             — ObjectSet 基元（12 基元之 12）
     ontology/instances/individual.py:25      — marking 字段（对象级，已实现）
     agent/security.py:76                     — required_markings 访问强制（已实现）
   - mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/
     v2_kernel/pg_repo.py                     — 9 张 ont_* 表 PG 持久化 + SQL 执行
     v2_kernel/api.py                         — v2 REST 面（/query 与 :evaluate）
   - mate-platform-backend/packages/mate-tech-mcp/src/mate_tech_mcp/main.py
     — MCP 工具注册处（现 3 个手写工具 + ontology 只读 resource）
   - mate-platform-backend/packages/mate-app-copilot/src/mate_app_copilot/agent_loop.py
     — SuperAI 聊天 agent loop（现唯一工具是硬编码 DISPATCH_TOOL_SCHEMA:46）

## 提交顺序（强约束）

docs/ADR → contract → failing tests → feature → infrastructure → acceptance evidence
Conventional Commits；PR 引用 spec §4.2 + 对应 ADR + operationId + ACCEPTANCE.md。
每批独立 ACCEPTANCE.md（不合并档）+ HARD-RULES-MATRIX 对应行更新（硬规则 10）。

## 环境与基线（先确认再动手）

- 测试必须用 mate-platform-backend/.venv（Windows：./.venv/Scripts/python.exe）
- 基线命令：
  cd mate-platform-backend
  ./.venv/Scripts/python.exe -m pytest packages/mate-tech-orchestrator/tests -q
    （预期 47 passed / 1 skipped——2026-08-17 已修复 superai_a2a 3 个 stale 测试）
  ./.venv/Scripts/python.exe -m pytest packages/mate-kernel/tests -q
- 任何新失败先修复或定位归属，不得带入本批

## ═══ Batch 任务（按序执行，单会话做一个）═══

### SAL-01 · Ontology 工具化基座（读，当前批，设计已定案 ADR-0043）

分支：基于 main 新建 refactor/mp-sal-01

1. contract：扩 mate-platform-backend/contracts/openapi/services/ont.yaml
   —— object_query v2（结构化 IR）/ inspect_class / 工具清单端点（硬规则 1）
2. failing tests：
   - IR 算子单测：aggregate(group_by+sum/count/avg/min/max) / traverse(link 遍历) /
     多键 sort，InMemory 与 PG 双后端断言同一结果
   - copilot e2e：发布 ObjectType → 工具清单出现 query_<slug> → 模拟 FC 调用
     查询 → 断言结构化结果 + result_schema
   - marking negative：agent 缺标记时工具不可见且直调被拒
3. feature（全部遵循 ADR-0043 九条定案，不得偏离）：
   - mate-kernel/objectset/：新增 ObjectSetQuery IR（filters/aggregation/traversal/
     多键 sort/paging）；filter_expr 字符串降为编译进 IR 的前端糖；双后端消费同一 IR
   - 执行器协议放宽为结果信封 {kind: objects|aggregates, rows}
   - mate-kernel/tooling/schema_gen.py：从 ObjectType 生成协议无关 tool schema
     （query_<slug> 专用工具是 IR 薄外壳；配套 list_classes + inspect_class）
   - 虚拟注册表：tools/list 从 ont_object_types 实时计算（短 TTL 缓存），零 push 同步
   - markings 上抬一级：ObjectType 加 marking 字段；
     可见工具 = 类型标记 ⊆ agent required_markings；查询时同规则二次校验
   - 双消费者接线：mate-tech-mcp 注册 + copilot agent_loop 注入 LLM FC 工具
   - MCP center 转调 tech-ont 走 mate-clients BearerAuth（硬规则 4，
     forbid_bare_httpx 自动覆盖）
4. acceptance：examples/01_kitchen_sink.py 追加「发布类型→生成工具→查询」一步；
   写 evidence/MP-SAL-01-ACCEPTANCE.md；更新 V31-ONTOLOGY-BOARD §SAL +
   PROGRAM-BOARD + HARD-RULES-MATRIX（硬规则 1/3/4/9/10 相关行）
5. 出范围（勿做）：typed client（SAL-05）/ 属性级可见 / push 事件同步 /
   Function 工具化（后续批）

### SAL-02 · OAG 检索上下文（想，依赖 01）

- 检索器：mate_kernel/rag/ontology.py（对象属性级原型）升级为 pgvector
  halfvec+HNSW embedding 召回 + ObjectSet IR 结构化过滤（复用平台既有 pgvector 设施，
  不沿用内存 dict/token 重叠）
- 通道：copilot agent_loop 当前零检索上下文（静态角色 prompt + 对话历史）——
  把检索结果以「对象卡片」（带 rid 可追溯）注入 agent prompt
- 验收：自然语言问题 → 命中对象进上下文带 rid；幻觉率对照实验（无 OAG vs 有 OAG）

### SAL-03 · Function 沙箱生产化（并行批，部署门）

- mate-kernel sandbox/k8s.py backend=k8s 真接 K8s Job（沿用 PLATFORM-K8S-01 Helm）；
  dev profile 保持 subprocess 双轨（ADR-0040 §2.5.1）
- copilot 真鉴权收口（现 dev 靠 LEGACY_LOGIN_COMPAT=1，生产前必须收）
- 验收：prod profile Function 走 K8s Job + NetworkPolicy 隔离；回滚方案文档化（硬规则 8）

### SAL-04 · Assisted Action 端到端（写，依赖 01，先起草 ADR-0044）

- ADR-0044（HITL 统一，本程序最重架构任务）：orchestrator plan review
  （approve 后现走 A2A worker）与 ActionProposal 状态机（apply 现从不校验 proposal）
  打通——review approve 路由到 ActionType.apply，proposal_id/hitl_token 全程流转
- Proposal/Scenario 语义：staged proposal（含预期 diff）+ 状态机；
  tech-ont 补 propose/confirm 端点；engine side_effect_emitter 接 outbox
  （现 pg_repo 调用不传）；copilot 补「AI 提议→确认→落库」端点与界面
- 验收：端到端「AI 提议→人确认→落库→outbox 事件」；未确认 proposal 永不落库
  negative；四段审计留痕（硬规则 9）

## 完成定义

北极星 demo（见上）端到端通过 + 两条 negative 通过 + 三批 ACCEPTANCE 齐备
（SAL-01/02/04）+ SAL-03 生产门收口 = 程序完成。
每收口一个 Batch：更新 V31-ONTOLOGY-BOARD §SAL、PROGRAM-BOARD、
HARD-RULES-MATRIX，并在交接说明中写明下一批入口。
```

---

## 接力交接（会话收尾必做）

1. `git log --oneline -5` 确认提交干净（Conventional Commits）。
2. 更新 `V31-ONTOLOGY-BOARD.md` §SAL 行状态 + `PROGRAM-BOARD.md`。
3. ACCEPTANCE.md 落档 `docs/active/delivery/evidence/MP-SAL-0X-ACCEPTANCE.md`（独立，不合并档）。
4. 交接说明三行：本批完成了什么 / 基线测试状态 / 下一批入口（分支名 + 本 prompt 对应 Batch 节）。
