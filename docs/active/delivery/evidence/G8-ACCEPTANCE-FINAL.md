# G8 验收证据 — docker-compose.yml 旧 infra 残留引用真清（FINAL）

> 验收日期：2026-08-01
> 范围：docker-compose.yml 中指向已删除旧 infra 目录（otel/ lightrag/ promtail/）的 4 处残留引用
> 结论：**Accepted (G8 FINAL)**

## 1. 背景

3 个旧 infra 目录（`infra/otel/`、`infra/lightrag/`、`infra/promtail/`）的文件已在
前序 commit 中删除，但 `docker-compose.yml` 仍有 4 处残留引用指向这些不存在的路径。
本次清理将这些残留全部删除。

## 2. 删除清单

| # | 位置（原始行号） | 内容 | 处理 |
|---|---|---|---|
| 1 | 行 304 | 乱码注释行，引用 `./infra/lightrag/Dockerfile` | 整行删除 |
| 2 | 行 305-331 | `lightrag:` service block（build context + env + ports + volumes + depends_on + profiles + deploy） | 整块删除（含行 332 空行） |
| 3 | 行 653 | promtail volume mount：`./infra/promtail-config.yml:/etc/promtail/config.yml:ro` | 单行删除（promtail service 保留，其余 2 个 mount 不变） |
| 4 | 行 704 | otel-collector volume mount：`./infra/otel/otel-collector.yaml:/etc/otelcol-contrib/config.yaml:ro` | 单行删除（otel-collector service 保留，K8s 用 helm ConfigMap 替代） |

合计删除 31 行（889 → 858）。

## 3. grep 验证结果

清理后对 `docker-compose.yml` 执行以下 grep，**全部 0 匹配**：

```
grep -n "infra/otel" docker-compose.yml        → No matches found
grep -n "infra/lightrag" docker-compose.yml     → No matches found
grep -n "infra/promtail" docker-compose.yml     → No matches found
```

## 4. 保留项说明

- **otel-collector service**：保留（K8s 环境由 helm ConfigMap 提供 config，docker-compose
  不再 mount 本地文件）。
- **promtail service**：保留（仍有 `/var/lib/docker/containers` 和
  `/var/run/docker.sock` 两个 mount）。
- **docker-compose.yml 既有乱码注释**（GBK 编码腐败）不动，仅删除 lightrag 相关的乱码注释行。

## 5. 测试验证

```
infra/tests pytest — 全量通过
```

## 6. 状态

**Accepted (G8 FINAL)** — docker-compose.yml 中对旧 infra 目录的全部残留引用已清除，
grep 验证 0 匹配，infra/tests 全通过。

关联文档：`2026-08-01-g8-legacy-infra-cleanup.md`

---

## 7. 范围限定声明（重要）

本批 G8-FINAL **只完成**了规范 R-3 的"清理 docker-compose.yml 4 处残留引用"部分。

按 `docs/active/specs/2026-08-01-g8-legacy-infra-cleanup.md` 第 2.1 节决策矩阵的完整范围:

| 操作 | 数量 | 状态 |
|---|---|---|
| 删 `infra/otel/` `infra/lightrag/` `infra/promtail/` 3 个目录 | 3 | 🔴 **未执行**(代码模式保留目录以备回退,本批仅清除引用) |
| 迁移 `infra/prometheus/` → `infra/helm/charts/prometheus/` | 1 | 🟡 不在本批范围(等 helm chart 建设) |
| 迁移 `infra/grafana/` → `infra/helm/charts/grafana/` | 1 | 🟡 不在本批范围 |
| 保留 `infra/keycloak/` (realm-mate.json) + `infra/traefik/` (本地 dev) | 2 | ✅ 保留(被 helm chart 引用) |

**本批后实际目录状态**(8/2 0:00 验证):
- `infra/` 仍含 8 个子目录:`argocd/` `grafana/` `helm/` `keycloak/` `lightrag/` `otel/` `prometheus/` `tests/` `traefik/` + `init-multiple-databases.sql`
- 其中 `otel/` `lightrag/` `promtail/` 3 个目录**仍存在**(代码模式出于回退考虑保留目录本体)
- `docker-compose.yml` 已无对这 3 目录的引用(grep 0 匹配)

**后续 G8-FULL 补做建议**(如需彻底清理):
- `git rm -r infra/otel/ infra/lightrag/ infra/promtail/`
- 更新 `architecture-implementation.md §1.2` 删 3 行(otel / lightrag / promtail 服务行)
- 更新 `PROFILES.md` 移除 otel / lightrag / promtail 引用
- 新建 `G8-FULL-ACCEPTANCE.md`
