# mate-tech-ont Runbook

## 概述

Mate Platform Ontology 服务（Neo4j 图 + OWL 2 + SPARQL + 双写 PG）。

## 启动

```bash
cd packages/mate-tech-ont
uv run --package mate-tech-ont python -m mate_tech_ont.main
```

## 端点

| Method | Path | 说明 |
|---|---|---|
| GET | /healthz | 健康检查 |
| POST | /api/v1/ont/ontologies | 创建本体 |
| GET | /api/v1/ont/ontologies/{id} | 读取本体 |
| POST | /api/v1/ont/classes | 创建类 |
| GET | /api/v1/ont/classes/{id} | 读取类 |
| POST | /api/v1/ont/instances | 创建实例 |
| GET | /api/v1/ont/instances/{id} | 读取实例 |
| GET | /api/v1/ont/instances?class_id= | 按类过滤 |
| DELETE | /api/v1/ont/instances/{id} | 删除实例（级联关系） |
| POST | /api/v1/ont/instances/relations | 创建关系 |
| GET | /api/v1/ont/instances/relations | 列出关系 |
| POST | /api/v1/ont/sparql | SPARQL → Cypher → 执行 |
| POST | /api/v1/ont/explain | SPARQL EXPLAIN |

## 数据模型

- **本体（Ontology）**: 命名空间 + 描述
- **类（Class）**: 父类 + 属性
- **实例（Instance）**: 类 + 属性
- **关系（Relation）**: src → dst，typed
- **版本（Version）**: ontology_id + version 隔离

## SPARQL 子集支持

```sparql
SELECT ?s WHERE { ?s :label "X" } LIMIT 10
INSERT { ?s :type :Concept } WHERE { ?s :label "X" }
DELETE { ?s :type :Concept } WHERE { ?s :label "X" }
```

→ 自动转 Cypher：`MATCH ... RETURN ...` / `CREATE ...` / `MATCH ... DELETE ...`

## OWL 2 导入导出

```python
from mate_tech_ont.owl.io import parse_owl_rdf_xml, export_owl_rdf_xml
result = parse_owl_rdf_xml(rdf_xml_str)  # OwlImportResult
xml = export_owl_rdf_xml(classes)
```

支持 RDF/XML 格式。wine ontology roundtrip 已验证。

## 双写策略

Neo4j 先写 → PG 后写。PG 失败 → Neo4j 自动 DETACH DELETE 回滚。

## 全文检索

中英 n-gram + Jaccard 相似度。

`fuzzy_match(query, candidates)` 返回排序后的 `SearchHit` 列表。

## 跨租户隔离

所有 CRUD 强制 `X-Tenant-Id` header。`assert_tenant_access()` 跨租户访问抛 `PermissionError`。

默认 tenant (`default`) 可访问所有资源（admin role）。

## 故障排查

| 现象 | 排查 |
|---|---|
| Neo4j 连接失败 | 检查 `NEO4J_URI` env + 网络 |
| SPARQL 400 | 检查 WHERE 子句语法 |
| OWL 解析失败 | 检查 RDF/XML 格式 |
| 跨租户 403 | 检查 X-Tenant-Id header |
| 双写部分失败 | 检查 PG 连接 + Neo4j 回滚日志 |