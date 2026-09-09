# PRD-38 推理任务最小闭环（ONT-G16+G13）

> **版本**: v1.0 · **日期**: 2026-09-08 · **状态**: `[x]` Accepted（live 三规则验证）
> **Requirement IDs**: FR-RSN-001..004 · **关联**: AxiomKind（G12 第一批 14 类型）/ Sprint 1

## 范围与验收
- FR-RSN-001 kernel `reasoning/engine.run_inference`（无状态）：R1 subclass 传递闭包（含环保护/多父并集）；R2 same_as 并查集聚簇；R3 transitive_property BFS 闭包
- FR-RSN-002 REST `POST /reasoning/run`（operationId ontRunV2Reasoning）
- FR-RSN-003 输出可断言：classification(asserted/inferred) / same_as_clusters / transitive_inferred / stats
- FR-RSN-004 单测 11/11（含环、空输入、自环、直接边不重复、多父）

## Live 记录（2026-09-08，经网关）
seed: employee⊑person⊑agent + emp-001/002 + same_as + reports_to 传递链 →
R1 emp-001 推得 {agent, person}；R2 簇 {emp-001:[emp-001,emp-002]}；R3 推得 (emp-001,mgr-01)；stats facts_inferred=6 ✅
