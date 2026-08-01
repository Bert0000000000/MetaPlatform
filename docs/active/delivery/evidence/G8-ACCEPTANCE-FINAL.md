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
