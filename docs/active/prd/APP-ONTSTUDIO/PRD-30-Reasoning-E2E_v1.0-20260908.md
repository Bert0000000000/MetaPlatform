# PRD-30 推理端到端（v2 kernel + ObjectSet + Function 打通）
> 版本: v1.0 · 日期: 2026-09-08 · 状态: [~]（G21：descendant_closure 落地，ObjectSet 祖先查询命中后代实例 live + ACL 负例；Function 为注册面打通，执行语义留增量）
> 关联: SAL spec G3 + 蓝图 §7.3 · 证据 scripts/smoke_ont_g21_reasoning_e2e.py
> FR: FR-RSN-001..004
FR-RSN-001 Axiom 注册 → 推理执行（R1/R2/R3）全链 REST
FR-RSN-002 推理闭包对 ObjectSet 查询可见（祖先查询命中后代实例）
FR-RSN-003 全程 tenant/ACL 透传（跨租户 axiom/class 拒绝）
FR-RSN-004 Function 执行语义（注册面已通，执行引擎留增量）
