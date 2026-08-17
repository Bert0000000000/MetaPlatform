# MP-SAL-04b ACCEPTANCE — Text-to-Ontology Ingest（文本→本体）

> **Batch**: MP-SAL-04b（ADR-0044 附录 · Text-to-Ontology：proposal kind 泛化 + create/model 执行腿）
> **日期**: 2026-08-17 · **分支**: `refactor/mp-sal-04b`
> **场景来源**: 用户提出「用户给 SuperAI 一个文本，如何落到本体库」——补齐 SAL-04 写腿的「建」语义

## 1. 交付范围

| 项 | 落点 | 状态 |
|---|---|---|
| proposal kind 泛化 | `ActionProposal.kind`（action / create_instance / model_type；subject rid 按 kind 语义）+ `propose(kind=...)` + `mark_applied`（仅 confirmed 可达，四态全守卫） | ✅ |
| create 实例执行 | `execute_proposal`：kind=create_instance → rid 生成（`ont.<t>.ind.<cls>.<pk>`）+ slug→rid 属性映射 + PK 必填校验 + 类型存在校验；InMemory/PG 双侧 | ✅ |
| model 类型执行 | kind=model_type → type_def 解析 → `upsert_object_type`（schema 变更必须人审——确认后才 execute） | ✅ |
| action 守卫 | kind=action 走 execute → 409 指引 `/action-types/{rid}/apply`（唯一写入口不旁路） | ✅ |
| 持久化 | `ont_proposal.kind` 列（ALTER 自愈）+ hydrate 回读；执行后行状态同步 applied | ✅ |
| REST | `POST /classes/{rid}/propose-instance` / `POST /object-types/propose` / `POST /proposals/{id}/execute`（409 映射 ProposalNotConfirmed/ValueError） | ✅ |
| copilot 工具 | `propose_create_instance` + `propose_model_type`（AI 只能提议）；**confirm/reject/execute 不在 LLM 工具面**（断言含 execute） | ✅ |

## 2. 契约

ont.yaml 36→**39 paths** / 60→**62 schemas**（InstanceProposeV2 / TypeProposeV2 + execute 响应）。

## 3. 测试

kernel **487 passed**（+11：kind 语义 / mark_applied 四态守卫 / create+model 正负路径 / action 守卫）；ont 全量 666 合跑绿；copilot 工具面 11 passed（7 固定工具 + 边界断言）。ruff/pyright 零新增。

## 4. Live 实机验证（用户场景原样）

> 文本：「供应商华信科技（华东），联系人张三 13800000000，评级 A，欠款 120 万」

| 步 | 结果 |
|---|---|
| AI 判类型不存在 → propose_model_type（6 属性类型定义） | pending ✓ |
| **negative**：未确认 execute | **409** ✓ 零落库 |
| 人 confirm → execute | supplier 类型落库 ✓ |
| AI propose_create_instance（文本抽取 6 字段） | pending ✓ |
| 人 confirm → execute | `ont.tenant-acme.ind.supplier.sup-hx-001` ✓ |
| IR 查询读回 | 6 字段全对（华信科技/华东/张三 138…/A/1200000）✓ |
| 建模即工具 | **query_supplier 即时出现在 agent 工具面** ✓ |
| proposal 状态 | applied + confirmed_by ✓ |

demo 数据已清理。

## 5. 结论

「文本→本体库」全链 = **提议（AI 抽取）→ 人闸（confirm）→ 执行（execute）**，建实例与建类型均不旁路 HITL；schema 变更额外强调人审。AI 全程只能提议——与 SAL-04 写腿同一治理模型。
