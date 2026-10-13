# 逆向发现继承实例关联修复验证

日期：2026-10-13。分支：`codex/data-modeling-phase1`。依据：[ADR-0083](../decisions/ADR-0083-data-driven-modeling-phase1.md)、[实施计划](../../superpowers/plans/2026-10-13-modeling-inherited-instance-links.md)。

## 修复范围

经过候选结构校验后，编译器将实际实例索引到自身及全部祖先；关系来源、目标和人工增删连线共用这一继承范围。实例节点继续使用实际子类标识和身份，不复制父类实例。原生写入、租户隔离、基线保护、关联字段匹配、基数、容量及合格子集隔离继续生效。请求/响应契约没有变化，无数据库迁移；没有修改前端产品组件或样式。

## 本地证据

使用本轮独立 PostgreSQL 16 容器 `mp-inheritance-fix-20261013`、非超级用户且无 BYPASSRLS 的 `inheritance_tester`，分别建立门禁、建模和浏览器数据库。API 19361 / UI 19360 为本轮独立服务。浏览器通过现有 IAM 获取真实令牌，独立 API 验证签名；未绕过鉴权。

| 验证 | 实际结果 | 本地证据 |
| --- | --- | --- |
| 修复前失败回归 | 自动关联来源数量只为 1 而应为 3；合法子类人工连线报 2 个错误 | 本轮 pytest 输出：2 failed、2 passed |
| 编译、数据处理、发布范围 | 160 passed | `.ci/inherited-fix-core.xml` |
| 全部建模 PG 集成 | 41 passed | `.ci/inherited-fix-modeling.xml` |
| 新建/复用/重复同步，两端继承 | 2 passed；每轮 24 个实例、36 条关系；实例/关系 RID 和实际端点保持稳定 | `.ci/inherited-fix-both-endpoints.xml` |
| 必需数据库六组门禁 | 123 executed、0 skipped；六组齐全 | `.ci/inherited-fix-postgres.xml` |
| 浏览器预览→发布→同步→重复同步 | 1 passed；36 条关系；父查询含 18 个子类实例；RID 稳定 | `metaplatform-frontend/test-results/modeling.xml` |
| 建模页前端单元测试 | 112 passed / 15 files | 本轮 Vitest 输出 |
| 代码格式、静态检查、差异空白检查 | Ruff / git diff --check 通过 | 本轮命令输出 |

植物固定样本具有父类植物标本、三个各 6 实例的子类、3 个采样点、3 个批次；两条父类声明关系各生成 18 条实例关系。另一个 PG 参数场景把采样点实例映射到采样点子类，验证目标继承写入也有效。没有生成父类实例。编译回归覆盖传递继承、兄弟后代、非法祖先/无关端点、人工增删、实例排除、发布范围、缺失目标提示、基数违规/部分隔离、边容量。

浏览器使用固定已审核候选和真实工作簿，不重新请求随机 AI 候选；AI 生成质量未作为本轮修复的验收结论。未执行部署、PR/主干 CI 或业务数据库补写；上述证据仅为本地验证。本轮测试结束后关闭独立服务并移除本轮容器，保留验证文件。

## 合并 main 验证

用户授权推送并合并 main 后，在独立工作树将 `cefc5444`（`codex/data-modeling-phase1`）与 `dc8980d3`（当时最新 `origin/main`）合并，无冲突。保留 main 的属性命名空间/HTTP 操作改动，并在合并源码上重新运行：后端编译与原生关系测试 199 passed；完整建模 PG 测试 42 passed；六组必需 PG 门禁 126 executed、0 skipped；建模页和继承图前端测试 116 passed；植物浏览器闭环 1 passed、36 条关系、重复同步 RID 稳定。独立容器为 `mp-inherited-main-20261013`，分别使用门禁、建模、关系并发、浏览器四个独立数据库，角色无超级用户/无 BYPASSRLS。

本地证据在主工作区 `.ci/inherited-main-core-native.xml`、`.ci/inherited-main-modeling.xml`、`.ci/inherited-main-postgres.xml`；浏览器证据在独立工作树 `metaplatform-frontend/test-results/modeling.xml`。首次扩展关系测试因未配置其专用数据库被入口拒绝；补建独立数据库后完整重跑通过。首次浏览器运行页面加载超时，原用例原参数复跑通过。未改用例跳过问题，未将失败计作通过。工作树与证据保留，测试服务和容器关闭；其他未提交工作与业务服务未改动。

## 生效方式

运行中的后端若未自动加载源码，需要重新加载/重启后端后使用。已经同步为零关系的来源不会自动补写；重新检查数据并显式同步即可按新规则生成关系。前端无需因本次后端修复重新构建。
