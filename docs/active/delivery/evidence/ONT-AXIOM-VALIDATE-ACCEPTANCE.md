# ONT-AXIOM-VALIDATE 验收证据（Axiom 运行时违规检查端点）

> **批次**：ONT-AXIOM-VALIDATE（IA 审视清单最后一项 · ADR-0070）
> **日期**：2026-09-24
> **分支**：`feat/ont-axiom-violation`（worktree `.worktrees/ontology-ia2-3-data`，基于 `origin/main@1cb670c3`）
> **决策**：ADR-0070（`docs/active/decisions/ADR-0070-axiom-runtime-validation.md`）
> **operationId**：`ontValidateV2Axioms`
> **Requirement ID**：`FR-ONT-AXIOM-VALIDATE`

## 1. 背景

IA v2 审视（2026-09-24）逐条核过 12 基元的前端消费面，收尾时只剩一条挂在
后端：**Axiom 只有 CRUD 清单，没有「这条公理在当前数据上是否被违反」的运行时
检查端点**。此前 LinkInstance 浏览（B）、ObjectSet 查询器（C）、SHACL 实例校验（F）
三项经勘察确认后端已契约化、属前端未接；Axiom 这一项是**真缺后端能力**，故单独立项。

## 2. 改动摘要与文件清单

**做了什么**：新增 `POST /api/v1/ont/v2/axioms/validate`，检查**当前数据实例**
是否违反已声明的公理。Core 三条规则：`disjoint`（个体类链同时落在两个不相交类
之下）/ `has_key`（同类实例主键重复）/ `subclass`（子类成环或自环）。其余
AxiomKind 计入 `stats.skipped`，不影响 `conforms`。

**新增**：

| 文件 | 职责 |
| --- | --- |
| `packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/axiom_validation.py` | `validate_axioms(repo, tenant_id, axiom_rid=, target_class=)`——纯函数、无 IO、可回归 |
| `packages/mate-tech-ont/tests/test_axiom_validation.py` | 16 项（10 单元 + 6 HTTP） |
| `docs/active/decisions/ADR-0070-axiom-runtime-validation.md` | 决策档（Accepted） |
| `docs/active/delivery/evidence/ONT-AXIOM-VALIDATE-ACCEPTANCE.md` | 本文件 |

**修改**：

| 文件 | 改动 |
| --- | --- |
| `packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py` | +40 行：`validate_axioms_endpoint`（挂在 Axiom CRUD 段之后，Function CRUD 之前） |
| `contracts/openapi/services/ont.yaml` | 新增 path + `AxiomValidationReport` schema |
| `contracts/openapi/platform.yaml` | `build_platform.py` 重建（生成物） |
| `contracts/openapi/generated/bundled.yaml` | `redocly bundle` 重建（生成物） |
| `docs/active/delivery/REQUIREMENT-MATRIX.yaml` | 新增 `FR-ONT-AXIOM-VALIDATE` |
| 前端 `api/ont/kernel.ts` | `validateAxioms()` + `AxiomValidationReport` 类型 |
| 前端 `pages/ontology/model/axioms/AxiomsPage.tsx` | PageHeader 加「运行时校验」按钮 + `SheetDetail` 抽屉展示报告 |

## 3. 实现要点与安全

- **租户守门（硬规则 #3 三层防线）**：handler 先 `_ctx(request)` 取租户，`axiom_rid`
  与 `target_class` 均做 `ont.<tenant>.` 前缀检查 → 跨租户一律 **403**；仓储调用走
  `_scoped_repo(request)`（GOVERN-06 `tenant_scope` + `install_rls`），
  `list_individuals` 显式传 `tenant_id`（`_ont_current_tenant` 是 ContextVar，
  能跨 `asyncio.to_thread`，但代码不依赖这一点，参数显式传更稳）。
- **同步 repo 调用推 threadpool**：`asyncio.to_thread`，不阻塞事件循环。
- **契约一致**：返回结构与 SHACL 报告同形（`{conforms, violations, stats}`），
  前端复用同一渲染模式。
- **不做的**（ADR-0070 §3）：完整 OWL 2 推理机、公理间交叉冲突检测、Axiom CRUD 契约变更。

## 4. 测试命令与真实结果（2026-09-23 实测）

| 命令 / 用例 | 结果 |
| --- | --- |
| `pytest packages/mate-tech-ont/tests/test_axiom_validation.py -q` | **16 passed**（10 单元 + 6 HTTP：200 报告 / 401 无 ctx / 403 跨租户 ×2 / `axiom_rid` 过滤 / disjoint 违规命中） |
| `pytest packages/mate-tech-ont/tests -q` | **510 passed / 0 failed / 0 skipped**（59.9s；含 PG 门控集成用例——本机 PG 可达故无 skip） |
| `python contracts/scripts/validate_contracts.py` | ✅ exit 0 |
| `python contracts/scripts/compare_runtime.py` | ✅ `missingInRuntime: []`（重建 runtime OpenAPI 后） |
| `python contracts/scripts/lint_sunset_headers.py` | ✅ 42 paths checked（新端点是 v2，无 sunset 要求） |
| `python contracts/scripts/validate_traceability.py` | ✅ |
| `python scripts/ci/validate_requirement_coverage.py` | ✅ 22 canonical service contracts with requirement IDs |
| `pytest contracts/tests -q` | **34 passed** |
| `python contracts/scripts/build_platform.py` | ✅ platform.yaml 重建（+2 行） |
| `redocly bundle platform@v1` | ✅ bundled.yaml 重建（+78 行） |
| 前端 `npx tsc -b --noEmit` | ✅ exit 0 |
| **真实网关 + 真实 JWT**（容器热更后，`admin/admin123`，租户 `tenant-default`） | ✅ `POST /api/v1/ont/v2/axioms/validate` `{}` → **200** `{"conforms":true,"violations":[],"stats":{"checked":82,"violated":0,"skipped":0}}`；单公理 → 200 `checked:1`；跨租户 `axiom_rid` → **403** `cross-tenant axiom denied` |
| **浏览器实证**（dev server 9254 起自本 worktree，登录后进 `/ontology/model/axioms`，点「运行时校验」） | ✅ 按钮在页、抽屉打开、渲染真实结果「✓ conforms / Core 规则 82 条已检查（命中 0 条）；0 条公理 kind 未覆盖，计入跳过」——**与 curl 实测数字一致** |

**新增测试如何转绿**：`test_axiom_validation.py` 在
`mate_tech_ont.v2_kernel.axiom_validation` 落地前为红（模块不存在），实现后
10 项单元转绿；HTTP 6 项随 `operation_id="ontValidateV2Axioms"` 路由接线转绿。

**关于登录按钮（澄清，避免误读）**：登录按钮点得动**不能**说明「dev 模式 Semi
Button noop」已修——`SharedLoginPage.tsx:433` 本来就是**原生 `<button>`**（该坑既有的
workaround 已落地）。真正有意义的是：本次新增的「运行时校验」是 **Semi `Button`**，
click → 抽屉打开 → 请求到后端 200，**Semi Button 的 onClick 在本次新起的 dev server
上正常触发**。即该 noop 现象与 HMR 历史状态相关，不是每条链路必撞——别把它当成
无条件前置假设。

## 5. 已知边界

1. **单次校验逐实例回查类链**：`_class_chain` 每级一次 `get_object_type`，租户实例
   规模大时是 N+1 查询。当前无性能问题，属可优化项（批量预取），不影响正确性。
2. **`subclass` 只判成环**：不做「A ⊑ B 且 B disjoint A」这类公理间交叉冲突。
3. **三个 Core kind 之外恒 skipped**：`transitivity` / `property_chain` / `functional` /
   `equivalent_class` 等不产生违规判定，只在 `stats.skipped` 计数。
4. **违规路径只测到单测/HTTP 层**：浏览器实证跑的是 `conforms: true` 真实数据
   （tenant-default 82 条公理全是 subclass 且无环）。**违规态的浏览器渲染未经真实
   数据实证**——要在共享 dev 库里造违规实例（重复主键 / 不相交类）才行，会污染
   tenant-default，故未做。违规判定本身由 2 项单元 + 1 项 HTTP 覆盖。
5. **UI 浏览器实证已完成**：见 §4 表——真实网关 + 真实 JWT + 抽屉真实结果，
   数字与 curl 一致。
6. **回滚**：纯增量（0 行删除），`git revert` 本批提交组即退回。

## 6. 本地栈同步方式（复现步骤 · 已执行并验证）

容器 bind mount 的是**主检出**的 `mate-platform-backend/packages/`（不是本 worktree）；
本地 main 停在 `15b55c5a`（落后 `origin/main` 三个 PR），故容器内没有本端点。
复现 UI 实证的步骤（本次已跑通）：

```bash
# 1) 把两个文件同步到主检出的 ont 包（api.py 与主检出只差本批 +40 行，0 删）
cp <worktree>/.../v2_kernel/api.py               <main>/.../v2_kernel/api.py
cp <worktree>/.../v2_kernel/axiom_validation.py  <main>/.../v2_kernel/axiom_validation.py
# 2) 重启容器
docker restart mate-tech-ont
# 3) dev server 起自本 worktree → 登录 → /ontology/model/axioms → 「运行时校验」
```

**验证后已还原**：主检出两个文件恢复干净（`git checkout -- api.py` + `rm
axiom_validation.py`）+ 再次 `docker restart mate-tech-ont`，使容器与宿主一致。
主检出是共享工作区，不留我的未跟踪文件（避免被别的会话 `git add -A` 扫进提交）。

⚠️ **本地 main 落后 `origin/main`** 是既有偏差，不是本批引入：容器内其余 ont
代码同样是旧版。合并本批后重建镜像才是正式生效路径。

## 7. 结论

**准出达成**：端点按契约落地、租户负例齐备（403 实测）、契约三产物同步、
runtime parity 无缺口、ont 包 510/510 全绿，且**真实网关 + 真实 JWT + 浏览器抽屉
三处数字一致**。IA v2 审视清单的**最后一项后端依赖项关闭**。

唯一自标边界：违规态的浏览器渲染未用真实数据实证（§5.4 说明了原因）。

## CI 门禁与证据（LOOP-ROLLOUT-01 模板字段）

**13 硬规则 job**：ga-001（`ont.yaml` + bundle 已同步，`compare_runtime` 无 missingInRuntime）、
ga-002（`FR-ONT-AXIOM-VALIDATE` 已登记 REQUIREMENT-MATRIX + requirements 注解）、
ga-006（tsc 绿）、ga-007（0 skipped）、ga-010（本文件即数据源）。
**证据**：本文件。**命令**：见 §4 表。**commit**：待 PR。
