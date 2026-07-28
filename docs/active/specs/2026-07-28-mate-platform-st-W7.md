# W7 子任务卡（ST）：蓝绿迁移（无 Java 兜底）

> **源任务卡**：[tasks-W7.md](./2026-07-27-mate-platform-tasks-W7.md)
> **总览**：[Task Breakdown v2.0](./2026-07-27-mate-platform-task-breakdown.md)
> **Sprint**：S11–S13（2026-09-22 ~ 2026-12-22）
> **里程碑**：M5（蓝绿上线）
> **ST 总数**：60（拆解自 31 个 TC）
> **粒度**：0.5-4 小时 / 单文件 / 单脚本 / 单测试

> **核心原则**：无 Java 兜底，每次迁移失败回退 v_{n-1} 7 天可观察期。

---

## 目录

- [W7-1 预发布环境搭建（9 ST）](#w7-1-预发布环境搭建9-st)
- [W7-2 蓝绿部署流程脚本（10 ST）](#w7-2-蓝绿部署流程脚本10-st)
- [W7-3 迁移 #1 msg+obs+mcp（8 ST）](#w7-3-迁移-1-msgobsmcp8-st)
- [W7-4 迁移 #2 ont+llmgw（8 ST）](#w7-4-迁移-2-ontllmgw8-st)
- [W7-5 迁移 #3 rag（7 ST）](#w7-5-迁移-3-rag7-st)
- [W7-6 迁移 #4 agent+app-kb（13 ST）](#w7-6-迁移-4-agentapp-kb13-st)
- [W7-7 v_{n-1} 保留 + 清理（5 ST）](#w7-7-v_n-1-保留--清理5-st)
- [完成度检查表](#完成度检查表)

---
## W7-1 预发布环境搭建（9 ST）

> **路线图工时**：1 周 | **关键路径**：是

### TC-7.1.1 独立 K8s namespace（2 ST）

#### ST-7.1.1.1 kubectl apply -f staging namespace yaml

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.1.1 |
| 工时 | 4h | 角色 | DevOps |
| 目标文件 | infra/k8s/staging/namespace.yaml |
| 前置 ST | W4.1.1（Traefik 已就位） |
| 输出 commit | dev: staging ns (ST-7.1.1.1) |

**改动清单**：
1. `kubectl apply -f staging/namespace.yaml`
2. namespace: mate-staging

**DoD**：
- [ ] kubectl get ns 看到 mate-staging

---

#### ST-7.1.1.2 service account 权限收窄 + ResourceQuota

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.1.1 |
| 工时 | 4h | 角色 | DevOps |
| 目标文件 | infra/k8s/staging/{sa,quota}.yaml |
| 前置 ST | ST-7.1.1.1 |
| 输出 commit | dev: staging rbac |

**改动清单**：
1. service account + Role/RoleBinding
2. ResourceQuota

**DoD**：
- [ ] 默认 sa 权限收窄

---
### TC-7.1.2 预发布 compose project（2 ST）

#### ST-7.1.2.1 docker-compose.staging.yml

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.1.2 |
| 工时 | 4h | 角色 | DevOps |
| 目标文件 | docker-compose.staging.yml |
| 前置 ST | TC-7.1.1 |
| 输出 commit | dev: staging compose |

**改动清单**：
1. 复制 dev compose + 加 staging 标签

**DoD**：
- [ ] `docker compose -p mate-staging up -d` 启一套

---

#### ST-7.1.2.2 staging 启动脚本

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.1.2 |
| 工时 | 4h | 角色 | DevOps |
| 目标文件 | scripts/start-staging.sh |
| 前置 ST | ST-7.1.2.1 |
| 输出 commit | dev: staging script |

**改动清单**：
1. 封装 compose -p mate-staging + healthcheck

**DoD**：
- [ ] 一键启动 staging

---
### TC-7.1.3 数据隔离（3 ST）

#### ST-7.1.3.1 PG schema 加 stg_ 前缀 + init script

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.1.3 |
| 工时 | 6h | 角色 | DevOps |
| 目标文件 | infra/init/postgres/staging/*.sql、docker-compose.staging.yml |
| 前置 ST | TC-7.1.2 |
| 输出 commit | dev: staging pg iso |

**改动清单**：
1. init script 全部表加 `stg_` 前缀

**DoD**：
- [ ] staging 有独立表

---

#### ST-7.1.3.2 Redis + Kafka 独立 namespace

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.1.3 |
| 工时 | 6h | 角色 | DevOps |
| 目标文件 | docker-compose.staging.yml |
| 前置 ST | ST-7.1.3.1 |
| 输出 commit | dev: staging redis+kafka iso |

**改动清单**：
1. redis / kafka 用独立 topic 前缀

**DoD**：
- [ ] 数据隔离

---

#### ST-7.1.3.3 MinIO bucket stg_ 前缀

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.1.3 |
| 工时 | 4h | 角色 | DevOps |
| 目标文件 | docker-compose.staging.yml |
| 前置 ST | ST-7.1.3.2 |
| 输出 commit | dev: staging minio iso |

**改动清单**：
1. bucket 加 `stg_` 前缀

**DoD**：
- [ ] dev 数据不会出现在 staging

---
### TC-7.1.4 流量影子（2 ST）

#### ST-7.1.4.1 Traefik mirror middleware

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.1.4 |
| 工时 | 4h | 角色 | DevOps |
| 目标文件 | infra/traefik/dynamic/middlewares/mirror-staging.yaml、infra/traefik/dynamic/routers/services.yaml |
| 前置 ST | TC-7.1.3 |
| 输出 commit | dev: shadow traffic |

**改动清单**：
1. mirror 中间件：5% 影子到 staging

**DoD**：
- [ ] 影子请求有 trace_id

---

#### ST-7.1.4.2 影子 trace_id 关联验证

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.1.4 |
| 工时 | 4h | 角色 | DevOps |
| 目标文件 | tests/test_shadow.py |
| 前置 ST | ST-7.1.4.1 |
| 输出 commit | test(dev): shadow trace |

**改动清单**：
1. 验证 trace_id 跨 staging-prod 关联

**DoD**：
- [ ] trace 关联工作

---
## W7-2 蓝绿部署流程脚本（10 ST）

> **路线图工时**：1 周 | **关键路径**：是

### TC-7.2.1 镜像双 tag（2 ST）

#### ST-7.2.1.1 .github/workflows/release.yml 双 tag

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.2.1 |
| 工时 | 4h | 角色 | DevOps |
| 目标文件 | .github/workflows/release.yml |
| 前置 ST | TC-7.1.2 |
| 输出 commit | ci: dual tag (ST-7.2.1.1) |

**改动清单**：
1. CI 同时打 `v_n` 与 `previous=latest`

**DoD**：
- [ ] 两个 tag 都存在

---

#### ST-7.2.1.2 双 tag 验证测试

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.2.1 |
| 工时 | 4h | 角色 | DevOps |
| 目标文件 | tests/ci/test_dual_tag.sh |
| 前置 ST | ST-7.2.1.1 |
| 输出 commit | ci: dual tag test |

**改动清单**：
1. 验证 ghcr.io 上 tag 都存在

**DoD**：
- [ ] 验证工作

---
### TC-7.2.2 Traefik 权重切换（3 ST）

#### ST-7.2.2.1 scripts/blue-green-switch.sh

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.2.2 |
| 工时 | 4h | 角色 | DevOps |
| 目标文件 | scripts/blue-green-switch.sh |
| 前置 ST | TC-7.2.1、TC-4.3.3 |
| 输出 commit | feat(gw): blue-green switch |

**改动清单**：
1. `blue-green-switch.sh <service> <weight>`：动态改权重

**DoD**：
- [ ] 脚本可执行

---

#### ST-7.2.2.2 Traefik provider file 热加载验证

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.2.2 |
| 工时 | 4h | 角色 | DevOps |
| 目标文件 | infra/traefik/dynamic/routers/services.yaml |
| 前置 ST | ST-7.2.2.1 |
| 输出 commit | feat(gw): weight reload |

**改动清单**：
1. file provider 自动重载

**DoD**：
- [ ] 5s 内生效

---

#### ST-7.2.2.3 权重切换集成测试

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.2.2 |
| 工时 | 4h | 角色 | DevOps |
| 目标文件 | tests/test_blue_green.sh |
| 前置 ST | ST-7.2.2.2 |
| 输出 commit | test(gw): blue-green |

**改动清单**：
1. mock 服务 + 切权重 + 验证流量比例

**DoD**：
- [ ] 权重可任意切

---
### TC-7.2.3 健康检查 + 自动回滚（3 ST）

#### ST-7.2.3.1 Prometheus 5xx 监控 + alert

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.2.3 |
| 工时 | 4h | 角色 | DevOps |
| 目标文件 | infra/prometheus/alerts/blue-green.yaml |
| 前置 ST | TC-7.2.2 |
| 输出 commit | feat(gw): 5xx alert |

**改动清单**：
1. v_n 服务 5xx > 1% alert

**DoD**：
- [ ] alert 配置

---

#### ST-7.2.3.2 scripts/auto-rollback.sh

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.2.3 |
| 工时 | 6h | 角色 | DevOps |
| 目标文件 | scripts/auto-rollback.sh |
| 前置 ST | ST-7.2.3.1 |
| 输出 commit | feat(gw): auto rollback |

**改动清单**：
1. 监听 alert → 触发回滚（60s 内）

**DoD**：
- [ ] 注入故障 30s 内回滚

---

#### ST-7.2.3.3 回滚注入测试

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.2.3 |
| 工时 | 4h | 角色 | DevOps |
| 目标文件 | tests/test_auto_rollback.sh |
| 前置 ST | ST-7.2.3.2 |
| 输出 commit | test(gw): auto rollback |

**改动清单**：
1. 模拟 5xx → 验证回滚

**DoD**：
- [ ] 自动回滚工作

---
### TC-7.2.4 切换 runbook（2 ST）

#### ST-7.2.4.1 docs/runbooks/blue-green.md

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.2.4 |
| 工时 | 4h | 角色 | DevOps |
| 目标文件 | docs/runbooks/blue-green.md |
| 前置 ST | TC-7.2.2、TC-7.2.3 |
| 输出 commit | docs: blue-green runbook |

**改动清单**：
1. 完整 runbook：演练 → 双写 → 切流量 → 监控 → 回滚

**DoD**：
- [ ] 文档完整

---

#### ST-7.2.4.2 runbook 演练

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.2.4 |
| 工时 | 4h | 角色 | DevOps |
| 目标文件 | docs/active/reports/runbook-drill.md |
| 前置 ST | ST-7.2.4.1 |
| 输出 commit | docs: runbook drill |

**改动清单**：
1. 新人按文档演练 30 分钟内切一个 service

**DoD**：
- [ ] 演练达标

---
## W7-3 迁移 #1 msg+obs+mcp（8 ST）

> **路线图工时**：3 周 | **关键路径**：是

### TC-7.3.1 预发布 3 模块联合演练（2 ST）

#### ST-7.3.1.1 staging 启动 3 模块 + 端到端 200

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.3.1 |
| 工时 | 8h | 角色 | DevOps + Backend |
| 目标文件 | tests/rehearsal/msg-obs-mcp-e2e.sh |
| 前置 ST | TC-7.2.3、W5-1/2/3 |
| 输出 commit | migrate: msg+obs+mcp rehearsal |

**改动清单**：
1. staging 起 3 模块
2. e2e 测试通过

**DoD**：
- [ ] 端到端 200

---

#### ST-7.3.1.2 演练问题清单 + 修复

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.3.1 |
| 工时 | 8h | 角色 | Backend |
| 目标文件 | docs/migration/msg-obs-mcp-rehearsal.md |
| 前置 ST | ST-7.3.1.1 |
| 输出 commit | docs: rehearsal report |

**改动清单**：
1. 跑 1 周演练 + 记录问题

**DoD**：
- [ ] 演练报告

---
### TC-7.3.2 数据双写（2 ST）

#### ST-7.3.2.1 tech-msg 双写 v_n + v_{n-1}

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.3.2 |
| 工时 | 8h | 角色 | Backend |
| 目标文件 | apps/tech-msg/src/tech_msg/dual_write.py |
| 前置 ST | TC-7.3.1 |
| 输出 commit | migrate: dual write msg |

**改动清单**：
1. 生产端同步写 v_n 与 v_{n-1}

**DoD**：
- [ ] 双写工作

---

#### ST-7.3.2.2 双写数据差异 < 0.01% 验证

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.3.2 |
| 工时 | 8h | 角色 | Backend |
| 目标文件 | tests/test_dual_write_diff.py |
| 前置 ST | ST-7.3.2.1 |
| 输出 commit | test(migrate): dual write diff |

**改动清单**：
1. 跑 3 天双写 + 对比

**DoD**：
- [ ] 差异 < 0.01%

---
### TC-7.3.3 流量切 10%（1 ST）

#### ST-7.3.3.1 blue-green-switch.sh tech-msg 10

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.3.3 |
| 工时 | 8h | 角色 | DevOps |
| 目标文件 | scripts/migrate/msg-obs-mcp-10pct.sh |
| 前置 ST | TC-7.3.2 |
| 输出 commit | migrate: 10% cutover |

**改动清单**：
1. 切 10% + 监控 24h

**DoD**：
- [ ] 错误率 < 0.1%

---
### TC-7.3.4 流量切 50%（1 ST）

#### ST-7.3.4.1 blue-green-switch.sh tech-msg 50

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.3.4 |
| 工时 | 8h | 角色 | DevOps |
| 目标文件 | scripts/migrate/msg-obs-mcp-50pct.sh |
| 前置 ST | TC-7.3.3 |
| 输出 commit | migrate: 50% cutover |

**改动清单**：
1. 切 50% + 监控 24h

**DoD**：
- [ ] 监控达标

---
### TC-7.3.5 流量切 100%（1 ST）

#### ST-7.3.5.1 blue-green-switch.sh tech-msg 100

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.3.5 |
| 工时 | 8h | 角色 | DevOps |
| 目标文件 | scripts/migrate/msg-obs-mcp-100pct.sh |
| 前置 ST | TC-7.3.4 |
| 输出 commit | migrate: 100% cutover |

**改动清单**：
1. 切 100% + 监控 7 天

**DoD**：
- [ ] 0 P0/P1

---
### TC-7.3.6 迁移完成报告（1 ST）

#### ST-7.3.6.1 docs/migration/2026-10-msg-obs-mcp.md

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.3.6 |
| 工时 | 8h | 角色 | PM |
| 目标文件 | docs/migration/2026-10-msg-obs-mcp.md |
| 前置 ST | TC-7.3.5 |
| 输出 commit | docs: migration 1 report |

**改动清单**：
1. 指标对比 + 问题清单 + 回滚预案

**DoD**：
- [ ] 报告完整

---
## W7-4 迁移 #2 ont+llmgw（8 ST）

> **路线图工时**：2 周 | **关键路径**：是

### TC-7.4.1 预发布联合演练（2 ST）

#### ST-7.4.1.1 staging 起 ont + llmgw

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.4.1 |
| 工时 | 4h | 角色 | DevOps + Backend |
| 目标文件 | tests/rehearsal/ont-llmgw-e2e.sh |
| 前置 ST | TC-7.3.5、W5-4/5 |
| 输出 commit | migrate: ont+llmgw rehearsal |

**改动清单**：
1. staging 起 2 模块

**DoD**：
- [ ] 端到端 200

---

#### ST-7.4.1.2 演练问题修复

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.4.1 |
| 工时 | 4h | 角色 | Backend |
| 目标文件 | docs/migration/ont-llmgw-rehearsal.md |
| 前置 ST | ST-7.4.1.1 |
| 输出 commit | docs: rehearsal 2 report |

**改动清单**：
1. 跑 3 天 + 修复

**DoD**：
- [ ] 演练通过

---
### TC-7.4.2 流量分阶段切（3 ST）

#### ST-7.4.2.1 切 10%

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.4.2 |
| 工时 | 8h | 角色 | DevOps |
| 目标文件 | scripts/migrate/ont-llmgw-10pct.sh |
| 前置 ST | TC-7.4.1 |
| 输出 commit | migrate: ont+llmgw 10% |

**DoD**：
- [ ] 切 10% 工作

---

#### ST-7.4.2.2 切 50%

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.4.2 |
| 工时 | 8h | 角色 | DevOps |
| 目标文件 | scripts/migrate/ont-llmgw-50pct.sh |
| 前置 ST | ST-7.4.2.1 |
| 输出 commit | migrate: ont+llmgw 50% |

**DoD**：
- [ ] 切 50% 工作

---

#### ST-7.4.2.3 切 100%

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.4.2 |
| 工时 | 8h | 角色 | DevOps |
| 目标文件 | scripts/migrate/ont-llmgw-100pct.sh |
| 前置 ST | ST-7.4.2.2 |
| 输出 commit | migrate: ont+llmgw 100% |

**DoD**：
- [ ] 切 100% 工作

---
### TC-7.4.3 数据一致性校验（2 ST）

#### ST-7.4.3.1 Neo4j 实例数 + 关系数对比

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.4.3 |
| 工时 | 8h | 角色 | Backend |
| 目标文件 | scripts/migrate/check-neo4j-consistency.sh |
| 前置 ST | TC-7.4.2 |
| 输出 commit | migrate: neo4j consistency |

**改动清单**：
1. 对照 Neo4j 实例 + 关系数

**DoD**：
- [ ] 差异 < 0.01%

---

#### ST-7.4.3.2 llmgw 用量对比

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.4.3 |
| 工时 | 8h | 角色 | Backend |
| 目标文件 | scripts/migrate/check-llmgw-consistency.sh |
| 前置 ST | ST-7.4.3.1 |
| 输出 commit | migrate: llmgw consistency |

**改动清单**：
1. 对照 token 用量

**DoD**：
- [ ] 差异 < 0.01%

---
### TC-7.4.4 迁移完成报告（1 ST）

#### ST-7.4.4.1 docs/migration/2026-11-ont-llmgw.md

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.4.4 |
| 工时 | 8h | 角色 | PM |
| 目标文件 | docs/migration/2026-11-ont-llmgw.md |
| 前置 ST | TC-7.4.3 |
| 输出 commit | docs: migration 2 report |

**DoD**：
- [ ] 报告完整

---
## W7-5 迁移 #3 rag（7 ST）

> **路线图工时**：2 周 | **关键路径**：是

### TC-7.5.1 预发布 + 检索质量对比（2 ST）

#### ST-7.5.1.1 W5-6.10 评估集跑 staging

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.5.1 |
| 工时 | 8h | 角色 | QA + Backend |
| 目标文件 | apps/tech-rag/scripts/eval-compare.py |
| 前置 ST | TC-7.4.4、W5-6 |
| 输出 commit | migrate: rag rehearsal |

**改动清单**：
1. 评估集跑 staging + v_n vs v_{n-1}

**DoD**：
- [ ] nDCG@10 差异 < 2%

---

#### ST-7.5.1.2 评估差异修复

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.5.1 |
| 工时 | 8h | 角色 | Backend |
| 目标文件 | docs/migration/rag-rehearsal.md |
| 前置 ST | ST-7.5.1.1 |
| 输出 commit | docs: rag rehearsal report |

**改动清单**：
1. 评估差异原因 + 修复

**DoD**：
- [ ] 评估达标

---
### TC-7.5.2 流量分阶段切（3 ST）

#### ST-7.5.2.1 切 10%

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.5.2 |
| 工时 | 8h | 角色 | DevOps |
| 目标文件 | scripts/migrate/rag-10pct.sh |
| 前置 ST | TC-7.5.1 |
| 输出 commit | migrate: rag 10% |

**DoD**：
- [ ] 切 10% 工作

---

#### ST-7.5.2.2 切 50%

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.5.2 |
| 工时 | 8h | 角色 | DevOps |
| 目标文件 | scripts/migrate/rag-50pct.sh |
| 前置 ST | ST-7.5.2.1 |
| 输出 commit | migrate: rag 50% |

**DoD**：
- [ ] 切 50% 工作

---

#### ST-7.5.2.3 切 100%

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.5.2 |
| 工时 | 8h | 角色 | DevOps |
| 目标文件 | scripts/migrate/rag-100pct.sh |
| 前置 ST | ST-7.5.2.2 |
| 输出 commit | migrate: rag 100% |

**DoD**：
- [ ] 切 100% 工作

---
### TC-7.5.3 向量数据一致性（1 ST）

#### ST-7.5.3.1 Milvus 向量数 + id 对照

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.5.3 |
| 工时 | 8h | 角色 | Backend |
| 目标文件 | scripts/migrate/check-milvus-consistency.sh |
| 前置 ST | TC-7.5.2 |
| 输出 commit | migrate: milvus consistency |

**改动清单**：
1. Milvus 向量数 + id 比对

**DoD**：
- [ ] 差异 < 0.01%

---
### TC-7.5.4 迁移完成报告（1 ST）

#### ST-7.5.4.1 docs/migration/2026-11-rag.md

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.5.4 |
| 工时 | 8h | 角色 | PM |
| 目标文件 | docs/migration/2026-11-rag.md |
| 前置 ST | TC-7.5.3 |
| 输出 commit | docs: migration 3 report |

**DoD**：
- [ ] 报告完整

---
## W7-6 迁移 #4 agent+app-kb（13 ST）

> **路线图工时**：3 周 | **关键路径**：是

### TC-7.6.1 预发布 + 4 个场景验证（3 ST）

#### ST-7.6.1.1 S1 场景 staging 验证

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.6.1 |
| 工时 | 8h | 角色 | QA + Backend |
| 目标文件 | tests/rehearsal/agent-s1.sh |
| 前置 ST | TC-7.5.4、W5-7/8 |
| 输出 commit | migrate: agent+kb s1 |

**DoD**：
- [ ] S1 通过

---

#### ST-7.6.1.2 S2 场景 staging 验证

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.6.1 |
| 工时 | 8h | 角色 | QA + Backend |
| 目标文件 | tests/rehearsal/agent-s2.sh |
| 前置 ST | ST-7.6.1.1 |
| 输出 commit | migrate: agent+kb s2 |

**DoD**：
- [ ] S2 通过

---

#### ST-7.6.1.3 S3+S4 场景 staging 验证

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.6.1 |
| 工时 | 8h | 角色 | QA + Backend |
| 目标文件 | tests/rehearsal/agent-s3-s4.sh |
| 前置 ST | ST-7.6.1.2 |
| 输出 commit | migrate: agent+kb s3+s4 |

**DoD**：
- [ ] S3+S4 全过

---
### TC-7.6.2 流量分阶段切（3 ST）

#### ST-7.6.2.1 切 10%

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.6.2 |
| 工时 | 12h | 角色 | DevOps |
| 目标文件 | scripts/migrate/agent-kb-10pct.sh |
| 前置 ST | TC-7.6.1 |
| 输出 commit | migrate: agent+kb 10% |

**DoD**：
- [ ] 切 10% 工作

---

#### ST-7.6.2.2 切 50%

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.6.2 |
| 工时 | 12h | 角色 | DevOps |
| 目标文件 | scripts/migrate/agent-kb-50pct.sh |
| 前置 ST | ST-7.6.2.1 |
| 输出 commit | migrate: agent+kb 50% |

**DoD**：
- [ ] 切 50% 工作

---

#### ST-7.6.2.3 切 100%

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.6.2 |
| 工时 | 12h | 角色 | DevOps |
| 目标文件 | scripts/migrate/agent-kb-100pct.sh |
| 前置 ST | ST-7.6.2.2 |
| 输出 commit | migrate: agent+kb 100% |

**DoD**：
- [ ] 切 100% 工作

---
### TC-7.6.3 E2E 全量回归（2 ST）

#### ST-7.6.3.1 W6-6 E2E 跑 staging

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.6.3 |
| 工时 | 8h | 角色 | QA |
| 目标文件 | tests/e2e/run-on-staging.sh |
| 前置 ST | TC-7.6.2 |
| 输出 commit | test(migrate): e2e regression |

**改动清单**：
1. W6-6 所有 E2E 跑 staging

**DoD**：
- [ ] 100% 绿

---

#### ST-7.6.3.2 E2E 失败用例分析

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.6.3 |
| 工时 | 8h | 角色 | QA |
| 目标文件 | docs/migration/e2e-regression.md |
| 前置 ST | ST-7.6.3.1 |
| 输出 commit | docs: e2e regression report |

**改动清单**：
1. 失败用例分析 + 修复

**DoD**：
- [ ] 失败 0

---
### TC-7.6.4 性能对比（2 ST）

#### ST-7.6.4.1 p95 延迟对比 v_n vs v_{n-1}

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.6.4 |
| 工时 | 4h | 角色 | Backend |
| 目标文件 | apps/tech-agent/scripts/perf-compare.py |
| 前置 ST | TC-7.6.2 |
| 输出 commit | migrate: perf compare |

**改动清单**：
1. p95 延迟对比脚本

**DoD**：
- [ ] 差异 < 5%

---

#### ST-7.6.4.2 性能报告

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.6.4 |
| 工时 | 4h | 角色 | Backend |
| 目标文件 | docs/migration/perf-compare.md |
| 前置 ST | ST-7.6.4.1 |
| 输出 commit | docs: perf compare report |

**改动清单**：
1. 性能对比报告

**DoD**：
- [ ] 报告完整

---
### TC-7.6.5 业务指标对比（2 ST）

#### ST-7.6.5.1 检索成功率 + Agent 完成率

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.6.5 |
| 工时 | 4h | 角色 | PM |
| 目标文件 | scripts/migrate/biz-metric.py |
| 前置 ST | TC-7.6.3 |
| 输出 commit | migrate: biz metric |

**改动清单**：
1. 检索成功率 + Agent 完成率对比

**DoD**：
- [ ] 指标持平或更好

---

#### ST-7.6.5.2 业务指标报告

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.6.5 |
| 工时 | 4h | 角色 | PM |
| 目标文件 | docs/migration/biz-metric.md |
| 前置 ST | ST-7.6.5.1 |
| 输出 commit | docs: biz metric report |

**改动清单**：
1. 业务指标报告 + 用户反馈

**DoD**：
- [ ] 报告完整

---
### TC-7.6.6 迁移完成报告（M5 收官）（1 ST）

#### ST-7.6.6.1 docs/migration/2026-12-m5-golive.md

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.6.6 |
| 工时 | 8h | 角色 | PM |
| 目标文件 | docs/migration/2026-12-m5-golive.md |
| 前置 ST | TC-7.6.5 |
| 输出 commit | docs: m5 golive report |

**改动清单**：
1. M5 收官报告 + Go-Live 公告

**DoD**：
- [ ] 报告完整

---
## W7-7 v_{n-1} 保留 + 清理（5 ST）

> **路线图工时**：1 周 | **关键路径**：否

### TC-7.7.1 保留期提醒（2 ST）

#### ST-7.7.1.1 Slack 提醒脚本

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.7.1 |
| 工时 | 2h | 角色 | DevOps |
| 目标文件 | scripts/keepalive-slack-notify.sh |
| 前置 ST | TC-7.6.6 |
| 输出 commit | dev: keepalive alert |

**改动清单**：
1. 7 天期间每天 Slack 提醒

**DoD**：
- [ ] 提醒工作

---

#### ST-7.7.1.2 7 天可访问性验证

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.7.1 |
| 工时 | 2h | 角色 | DevOps |
| 目标文件 | tests/test_keepalive.sh |
| 前置 ST | ST-7.7.1.1 |
| 输出 commit | test(dev): keepalive |

**改动清单**：
1. 第 7 天仍可访问 v_{n-1}

**DoD**：
- [ ] 可访问性验证

---
### TC-7.7.2 自动清理脚本（2 ST）

#### ST-7.7.2.1 scripts/cleanup-old-releases.sh

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.7.2 |
| 工时 | 4h | 角色 | DevOps |
| 目标文件 | scripts/cleanup-old-releases.sh |
| 前置 ST | TC-7.7.1 |
| 输出 commit | dev: cleanup script |

**改动清单**：
1. 删 7 天前的镜像 + k8s 部署

**DoD**：
- [ ] 脚本工作

---

#### ST-7.7.2.2 定时任务 + 手动触发

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.7.2 |
| 工时 | 4h | 角色 | DevOps |
| 目标文件 | infra/cron/cleanup-cron.yaml |
| 前置 ST | ST-7.7.2.1 |
| 输出 commit | dev: cleanup cron |

**改动清单**：
1. k8s CronJob

**DoD**：
- [ ] 定时 + 手动均可

---
### TC-7.7.3 清理 runbook（1 ST）

#### ST-7.7.3.1 docs/runbooks/cleanup.md

| 字段 | 值 |
|---|---|
| 所属 TC | TC-7.7.3 |
| 工时 | 4h | 角色 | DevOps |
| 目标文件 | docs/runbooks/cleanup.md |
| 前置 ST | TC-7.7.2 |
| 输出 commit | docs: cleanup runbook |

**改动清单**：
1. 完整 runbook

**DoD**：
- [ ] runbook 完整

---

## W7 完成度检查表

| W7-n | 路线图 ID | 关键路径 | TC 数 | ST 数 | ST 总工时 | 状态 |
|---|---|---|---|---|---|---|
| W7-1 | §4 W7-1 | 是 | 4 | 9 | ~36h | 🔴 未启动 |
| W7-2 | §4 W7-2 | 是 | 4 | 10 | ~40h | 🔴 未启动 |
| W7-3 | §4 W7-3 | 是 | 6 | 8 | ~52h | 🔴 未启动 |
| W7-4 | §4 W7-4 | 是 | 4 | 8 | ~36h | 🔴 未启动 |
| W7-5 | §4 W7-5 | 是 | 4 | 7 | ~32h | 🔴 未启动 |
| W7-6 | §4 W7-6 | 是 | 6 | 13 | ~80h | 🔴 未启动 |
| W7-7 | §4 W7-7 | 否 | 3 | 5 | ~16h | 🔴 未启动 |
| **合计** | — | — | **31** | **60** | **~292h** | **🔴 未启动** |

> **关键路径 ST 数**：55（W7-1~6），必须 S11-S13 合入。

---

## 变更记录

| 日期 | 版本 | 变更 | 原因 |
|---|---|---|---|
| 2026-07-28 | v2.0 | 从 W7 TC（31 条）拆出 ST（60 条） | 单回合执行避免 Token 超限 |