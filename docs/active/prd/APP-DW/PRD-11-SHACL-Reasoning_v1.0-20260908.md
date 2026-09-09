# PRD-11 SHACL 推理
> 版本: v1.0 · 日期: 2026-09-08 · 状态: [ ] Not Started（shacl_engine.py 已有 6 约束子集，覆盖 W3C SHACL Core 需补 NodeShape/PropertyShape/Target/Severity 等）
> 关联: sprint 4 / ADR-0021
> FR: FR-SHACL-001..006

## 范围
FR-SHACL-001 NodeShape/PropertyShape 结构（sh:targetClass / sh:property / sh:path）
FR-SHACL-002 核心约束（minCount/maxCount/datatype/pattern/minInclusive/maxInclusive/in/closed）
FR-SHACL-003 违例报告（conforms + results[] 含 message/path/value）
FR-SHACL-004 与本体 validate_model/validate_instance 集成
FR-SHACL-005 与推理规则联动（SHACL 约束触发 Axiom 推理）
FR-SHACL-006 REST /reasoning/shacl/validate
