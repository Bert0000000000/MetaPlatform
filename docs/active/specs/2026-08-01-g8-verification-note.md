# Part 3 / Part 4 完成度验证报告

> 版本:v1.0 · 2026-08-01
> 修订人:需求层(TRAE)
> 状态:**Active**(供审计 + 给 code 模式回归使用)

---

## 1. 验证范围

本报告对照 8/1 code 模式输出与 PROGRAM-BOARD 实际状态,验证 Part 3(G6 RLS)与 Part 4(G8 旧 infra)的完成度。

---

## 2. Part 3 G6 RLS 迁移 — ✅ Accepted

### 2.1 证据(实际)

| 检查项 | 状态 |
|---|---|
| `mate-platform-backend/alembic/versions/20260801_0008_tenant_rls.py` | ✅ 已存在(8/1 21:13) |
| 覆盖范围 | ✅ 58 张表(超 4 张预期,实际覆盖全量 tenant_id 表) |
| RLS 启用 | ✅ `ALTER TABLE <t> ENABLE ROW LEVEL SECURITY` |
| FORCE RLS | ✅ `ALTER TABLE <t> FORCE ROW LEVEL SECURITY`(owner 也受策略约束) |
| 失败 default | ✅ `ALTER DATABASE "<db>" SET app.tenant_id = ''`(deny-by-default) |
| 验收证据 | ✅ `docs/active/delivery/evidence/G6-ACCEPTANCE.md`(8/1 21:16) |
| 与代码一致 | ✅ |

### 2.2 修订记录

PROGRAM-BOARD.md 第 54 行 G6 状态从 **Not Started** → **Accepted**,已在本报告中追加。

---

## 3. Part 4 G8 旧 infra 清理 — 🔴 Not Started(真实状态)

### 3.1 证据(实际)

| 检查项 | 状态 |
|---|---|
| `infra/otel/` 删除 | 🔴 仍在(8/1 13:40 mtime) |
| `infra/lightrag/` 删除 | 🔴 仍在(8/1 13:40 mtime) |
| `infra/promtail/` 删除 | 🔴 仍在(8/1 13:40 mtime) |
| `docker-compose.yml` 删 3 处 mount | 🔴 **仍引用** `lightrag`(line 305-323)与 `OTEL_EXPORTER_OTLP_ENDPOINT` |
| `architecture-implementation.md` §1.2 删 3 行 | 🔴 未改 |
| `PROFILES.md` 移除引用 | 🔴 未改 |
| PROGRAM-BOARD G8 状态 | 🟢 已正确标 **Not Started**(本报告校对后) |
| `G8-ACCEPTANCE.md` | 🔴 不存在(grep 无) |

### 3.2 文档与 commit 历史不一致说明

commit `d799b956` commit message 声称 "P3-W6 并行 wave 收口 — business + features + engines + **G8 旧 infra 清理**"。

但实际验证(8/1 23:00):
- `infra/{otel,lightrag,promtail}/` 3 个目录仍在
- `docker-compose.yml` line 305-323 仍引用 `lightrag` 服务
- `docker-compose.yml` line 86 仍引用 `OTEL_EXPORTER_OTLP_ENDPOINT`
- `architecture-implementation.md` §1.2 仍包含 otel / lightrag / promtail 服务行
- `PROFILES.md` 仍包含相关引用

**结论**:**commit message 与实际代码状态不一致**。可能是:
1. commit message 误标了"G8 旧 infra 清理",实际只完成了 business / features / engines 3 项
2. 或 G8 清理在另一个分支被回滚
3. 或代码已合并但后续被其他 PR 恢复

**PROGRAM-BOARD 已修正**:G8 状态保持 Not Started(无 commit message 误导)。

### 3.3 重新执行计划

按 `docs/active/specs/2026-08-01-g8-legacy-infra-cleanup.md` 规范,**Part 4 必须真正执行**:

```
PR #N (P3-W12 — G8):
  - 删:   infra/otel/ (1 文件)
  - 删:   infra/lightrag/ (1 文件)
  - 删:   infra/promtail/ (1 文件)
  - 改:   docker-compose.yml (删 3 处引用)
  - 改:   docs/active/specs/2026-07-27-mate-platform-architecture-implementation.md (§1.2 表格删 3 行)
  - 改:   docs/active/specs/PROFILES.md (移除对 otel/lightrag/promtail 的引用)
  - 改:   docs/active/delivery/PROGRAM-BOARD.md (G8 状态 Not Started → Accepted)
  - 新建: docs/active/delivery/evidence/G8-ACCEPTANCE.md
  - 验证: docker compose --profile infra up -d / pytest infra/tests / helm install
```

工作量:0.5 天(纯文件删除 + 测试)。

---

## 4. 同时完成的 G2/G3/G4/G5/G7 同步状态

| 项 | 状态 | 证据 |
|---|---|---|
| **G1** kafka sub-chart 落地 | 🟡 In Progress | 待选型 |
| **G2** pre-commit raw-SQL + secret 扫描 | ✅ **Accepted** | `G2-ACCEPTANCE.md`(8/1 20:33) |
| **G3** Outbox DDL 迁移 | ✅ **Accepted** | `G3-G7-ACCEPTANCE.md`(8/1 19:03),commit `85f4df75` |
| **G4** 真实 K8s 集成 e2e(kind) | ✅ **Accepted** | `G4-ACCEPTANCE.md`(8/1 21:19) |
| **G5** per-service security 段补齐 | ✅ **Accepted** | `G5-ACCEPTANCE.md`(8/1 21:08) |
| **G6** RLS 迁移 | ✅ **Accepted** | `G6-ACCEPTANCE.md`(8/1 21:16) |
| **G7** SealedSecrets 备份 runbook | ✅ **Accepted** | `G3-G7-ACCEPTANCE.md`(8/1 19:03) |
| **G8** 旧 infra 清理 | 🔴 **Not Started** | 本报告第 3 节说明 |

**已闭环 6 / 8 项硬规则**,待 G1 与 G8 收口。

---

## 5. 文档一致性修正

本报告涉及的修订(已在 8/1 22:00 同步):

| 文件 | 修订内容 |
|---|---|
| `docs/active/delivery/PROGRAM-BOARD.md` 第 52 / 53 / 54 行 | G4/G5/G6 状态从 Not Started / In Progress 改为 **Accepted**(附证据路径) |
| `docs/active/delivery/PROGRAM-BOARD.md` commit `d799b956` 行 | 添加 ⚠️ 校对警告,标注 G8 实际未完成 |
| `docs/active/specs/2026-07-27-mate-platform-delivery-roadmap.md` | v3.1 增量状态 G5/G6 同步为 Accepted |
| `docs/active/specs/2026-07-31-features-backlog.md` v1.3 | 新增 G5 / G6 / G8 校对警告 |

---

## 6. 结论

| 维度 | 结论 |
|---|---|
| **Part 3 G6 RLS** | ✅ **真正完成**,文档与代码一致 |
| **Part 4 G8 旧 infra** | 🔴 **真正未完成**,文档保持 Not Started,需 code 模式按规范执行 |
| **整体状态** | 6 / 8 GA 硬规则收口,**待 G1 + G8 收口完成 v3.1 GA 全部闭环** |

---

## 7. 关联文档

- `2026-08-01-r6-rls-migration.md` — G6 规范(已落地)
- `2026-08-01-g8-legacy-infra-cleanup.md` — G8 规范(待执行)
- `2026-08-01-code-mode-prompts.md` Part 4 — G8 prompt(等 code 模式执行)
- `docs/active/delivery/evidence/G6-ACCEPTANCE.md` — G6 验收证据
- `docs/active/delivery/PROGRAM-BOARD.md` — 全局批次跟踪
- `CHANGELOG.md` — 版本变更记录(待追加 G8 章节)

---

## 8. 变更记录

| 日期 | 变更 | 作者 |
|---|---|---|
| 2026-08-01 | v1.0 初版(Part 3 ✅ / Part 4 🔴 + 文档一致性修正) | 需求层(TRAE) |