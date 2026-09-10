# ONT-G9+G20 ACCEPTANCE — 导入导出与 OWL 互操作

> **日期**: 2026-09-08 · **PRD**: PRD-37 `[x]` · **部署**: mate-tech-ont

## 交付

REST `ontExportV2ObjectType`（jsonld/turtle 双格式）+ `ontImportV2ObjectType`
（content 回灌 upsert）。JSON-LD @context（owl/rdfs/schema）+ hasProperty 全属性签名。

## Live（经网关 · 真 PG，无 mock）

1. export ver-demo.v1 → jsonld，@id + 2 props ✅
2. DELETE v1 → GET 404 ✅
3. import 同 content → rid 回灌 props:2 ✅
4. GET 复查 display/props 与删除前一致 ✅
5. turtle 格式输出 @prefix + owl:Class ✅
