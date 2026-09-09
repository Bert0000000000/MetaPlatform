# PRD-20 Ontology CLI + SDK（ONT-G11）
> 版本: v1.1 · 日期: 2026-09-09 · 状态: [x]（CLI 最小版四子命令 + SDK typed client 已交付——mate_clients/ontology_sdk.py：ObjectType CRUD / proposal 状态机 / SHACL(含 subclass_axioms 推理联动) / reasoning / alignment，单测 8 + 网关 live 全链；完整 CLI 交互式/schema 校验/批量导入留增量）
> 关联: ONT-G11 / Sprint 4
> FR: FR-CLI-001..004 / FR-SDK-001..003
FR-CLI-001 list-classes（GET /ont/v2/object-types）
FR-CLI-002 get-type（GET /ont/v2/object-types/{rid}）
FR-CLI-003 query（POST /ont/v2/object-query）
FR-CLI-004 export（GET /ont/v2/object-types/{rid}/export）
FR-SDK-001 typed client（ObjectType CRUD / proposal / SHACL / reasoning / alignment）
FR-SDK-002 Bearer + tenant header 双注入（GOVERN-06）与 Idempotency-Key 自动携带
FR-SDK-003 契约错误映射（OntologySDKError{status, body}）

证据：packages/mate-clients/tests/test_ontology_sdk.py（8 passed）+ 网关 live
propose→confirm→execute→get 全链（2026-09-09）。
