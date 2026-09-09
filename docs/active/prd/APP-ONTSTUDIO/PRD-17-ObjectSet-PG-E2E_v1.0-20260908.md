# PRD-17 ObjectSet PG 真接端到端
> 版本: v1.0 · 日期: 2026-09-08 · 状态: [x] Accepted（ONT-G4：10k 实例 P50=25.0ms/P95=27.6ms；G17/G21 补充验证层）
> 关联: SAL G1 + RUNTIME / Sprint 3-5 · 证据 scripts/bench_object_query.py + SPRINT3-ACCEPTANCE §3
> FR: FR-OSPG-001..003
FR-OSPG-001 ObjectSet/ObjectQuery IR 到 PG SQL 编译执行
FR-OSPG-002 1 万级实例压测与 composite 索引
FR-OSPG-003 推理闭包对查询可见（G21 descendant_closure）
