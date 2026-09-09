# PRD-37 导入导出与 OWL 互操作（ONT-G9+G20）

> **版本**: v1.0 · **日期**: 2026-09-08 · **状态**: `[x]` Accepted（live 全链验证）
> **Requirement IDs**: FR-IOP-001..003 · **关联**: owl/io.py 深化 / Sprint 1

## 范围与验收
- FR-IOP-001 export JSON-LD：`GET /object-types/{rid}/export`（@context owl/rdfs/schema + hasProperty）
- FR-IOP-002 export Turtle：`?format=turtle`（@prefix + owl:Class/DatatypeProperty 行）
- FR-IOP-003 import：`POST /object-types/import`（export content 回灌，upsert 语义）

## Live 记录（2026-09-08，经网关 · 真 PG）
1. export ver-demo.v1 → jsonld 2 props ✅
2. DELETE v1 → GET 404 ✅
3. import content → rid 回灌 props:2 ✅；GET 一致（display/props 数）✅
4. turtle 输出含 @prefix owl rdfs + owl:Class 行 ✅
