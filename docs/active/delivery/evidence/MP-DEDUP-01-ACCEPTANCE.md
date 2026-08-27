# MP-DEDUP-01 验收记录

> 状态：`[~] 条件验收记录`（不是 v1.0 GA Accepted）
> 代码基线：`acd0a3fc`
> 记录日期：2026-08-27

## 范围

本批覆盖 Ontology ObjectType 的 tenant + slug 唯一约束、embedding 相似度预检、
merge proposal、HTTP precheck/merge/propose-merge，以及前端合并抽屉。

## 已验证

- Ontology 测试分片：`172 passed`，`48 skipped`。
- 跳过项均已明确报告 PostgreSQL/RLS 数据库未启动，不作为通过计数。
- Ontology 前端代码已包含 precheck、候选选择和 merge drawer，生产构建已通过。

## 未闭环项

- 必须在真实 PostgreSQL 上验证 partial UNIQUE、并发创建、跨租户隔离和 merge 回滚。
- 必须补齐真实 embedding provider 与大规模索引/性能证据。

## 结论

离线/HTTP 代码证据已归档；真实 PG/RLS 和性能验收完成前保持 `[~]`，不标记
为 v1.0 GA Accepted。
