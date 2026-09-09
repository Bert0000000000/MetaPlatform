# ONT-G16+G13 ACCEPTANCE — 推理任务最小闭环

> **日期**: 2026-09-08 · **PRD**: PRD-38 `[x]` · **部署**: kernel engine + mate-tech-ont REST

## 交付
kernel `reasoning/engine.run_inference`（R1 subclass 传递闭包（环保护/多父并集）、
R2 same_as 并查集、R3 transitive_property BFS）+ REST `ontRunV2Reasoning`。

## Live（经网关，seed 数据推理，无 mock）
seed：employee⊑person⊑agent；emp-001/002:employee；same_as(emp-001,emp-002)；
reports_to 传递链 emp-001→emp-002→mgr-01。
R1 emp-001 asserted [employee] → inferred [agent, person] ✅
R2 cluster {emp-001: [emp-001, emp-002]} ✅
R3 inferred (emp-001, mgr-01) ✅
stats: rules_applied=3, facts_inferred=6 ✅

## 测试
kernel 推理 11/11（三规则 + 环/空/自环/直边不重复/多父/断言保留）。
G12 联动：AxiomKind 第一批 14 类型为本引擎的公理声明面。
