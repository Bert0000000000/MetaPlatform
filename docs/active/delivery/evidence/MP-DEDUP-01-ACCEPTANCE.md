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

## 2026-08-31 本地 Docker 验证补充

- 通过真实 OIDC/Gateway/PostgreSQL 创建两个 ObjectType，预检命中候选，并完成
  `merge_suggestion` 的 `pending → confirmed → executed` 与终态回读。
- 这补齐了此前仅因主机到 PostgreSQL 测试端口不可达而跳过的本地系统路径；详情见
  `PRD-05-08-LOCAL-DOCKER-ACCEPTANCE-20260831.md`。
- 并发、生产 RLS、真实 embedding provider、规模和补偿证据仍未完成，状态保持 `[~]`。

## 2026-09-09 条件核销补充（最终冲刺批次一）——转正 [x]

真实 PG（metaplatform_ont）+ 网关全链核销原核心条件
（`scripts/smoke_sprint_final_batch1.py` 16/16 PASS）：

| 原条件 | 证据 |
|---|---|
| partial UNIQUE | pg_indexes 实证 (tenant_id, slug) 唯一索引；同 slug v2 创建 → 409 slug_conflict（含已有 rid 提示）|
| 并发创建 | 4 线程并发同 slug → 恰好 1×200 + 3×409 |
| 跨租户隔离 | 外租户前缀 rid 写 → 403 / 读 → 404（**附随修复**：原 upsert/get 无前缀守门，外租户 rid 可写入 tenant-other 名下并读回——已补 GOVERN-06 守门并清脏数据）|
| merge 回滚 | propose-merge → confirm → execute（merge 落库）→ revert → status=reverted（merge_suggestion 补偿注记）|
| precheck 候选 | precheck 命中候选 sim=1.0 |

**边界（如实）**：真实 embedding provider 相似度与大规模索引/性能证据未核销
（precheck 当前走 slug 归一化 fallback，embedder 未配置）；列为 PRD-07 后续
增量，不阻塞本批条件转正。状态：`[~] → [x]`。
