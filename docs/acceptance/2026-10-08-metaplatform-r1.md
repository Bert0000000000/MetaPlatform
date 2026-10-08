# MetaPlatform R1 本地验收记录

> 状态：R1（C0–C2）本地技术验收完成；任务审查与全分支最终审查通过，无未解决 Critical / Important。
> 范围：已接受路线图的准备工作与 R1（C0–C2）；后续远端结果见[集成记录](2026-10-08-metaplatform-r1-integration.md)，不代表 R2–R6、部署或业务试点通过。

## 来源与变更

- 仓库：用户指定的当前 `2026-07-02-MetaPlatform`；工作树 `C:\Users\houuu\.codex\worktrees\c385\2026-07-02-MetaPlatform`。
- 分支：`codex/metaplatform-r1`；审计基线 `e965d866b20dddf8d9ebb0418869b58a4697ee32`。
- [实施计划](../superpowers/plans/2026-10-08-metaplatform-r1-implementation.md)、[后续路线图](../superpowers/plans/2026-10-08-metaplatform-optimization-roadmap.md)。
- 单源：[ADR-0082](../active/decisions/ADR-0082-ontology-migration-plan.md)、[ADR-0080](../active/decisions/ADR-0080-ontology-draft-and-version-mechanism.md)。

| 任务 | 结果 | 实现提交 |
| --- | --- | --- |
| C0 接管与索引 | 标准 AGENTS 入口、历史指针更正、锁文件和验证入口；168 个字节码和 11 个 gitlink 仅取消索引跟踪，保留本地文件及 16 个既有工作树；独立审查通过 | `b8c7a3ce` |
| C1 必需测试 | PostgreSQL 非特权角色预检；六组完整采集/执行身份核对；FORCE RLS 专项；单独迁移浏览器配置和安全清单；审查发现的漏跑用例问题已修复并复审通过 | `84c38e3e`、`461da4a9`、`473b9051` |
| C2 迁移安全 | 真实边界负例、租户/家族及快照校验、规范计划、固定副作用集合和字段冲突 409；恢复页面可选 null 的默认语义；独立任务审查通过 | `f65bda36`、`22954b68`；ADR/契约与先失败测试分别提交 |

## 已完成的本地执行

| 执行阶段 | 用例数 | 失败 / 跳过 | 环境与边界 |
| --- | ---: | --- | --- |
| 原迁移基线 | 22 passed | 0 / 0 | 本任务 pgvector/PostgreSQL 16 容器、独立库、非特权业务角色；初始库未安装 vector 扩展，不主张向量路径覆盖 |
| C1 真实数据库回归 | 68 passed | 0 / 0 | 恢复后的独立 pgvector/PostgreSQL 16.15、vector 0.8.6；六组用例完整采集及逐条执行 |
| C1 非特权 FORCE RLS | 8 passed | 0 / 0 | 独立 native PostgreSQL 16.15，九张核心表 FORCE RLS；此环境没有 vector |
| C1 门禁行为 | 27 passed | 0 / 0 | 包括真实参数化采集、缺失/重复/额外用例和继承筛选参数负例 |
| C1 迁移浏览器 | 2 passed | 0 / 0 | 当前工作树代码、真实 Keycloak RS256 登录、独立 auth/gateway/Ont/Redis、native PostgreSQL；修复 C2 后须再执行 |
| C2 首次迁移安全专项 | 69 passed | 0 / 0 | 原 22 条与新增 47 条边界用例，真实 PostgreSQL |
| C2 可选 null 兼容与拒绝边界 | 23 passed | 0 / 0 | 页面实际请求体及非法类型、未知字段、租户/家族引用 |
| C2 最终数据库回归 | 123 passed | 0 / 0 | 同一 pgvector 非特权业务目标，六组完整采集执行，113.11 秒 |
| C2 最终迁移浏览器 | 2 passed | 0 / 0 | 重新加载本任务 Ont API 后执行，7.1 秒；保留两个原用例 |
| C2 契约测试 | 34 passed | 0 / 0 | 来源 YAML、生成 bundle、契约测试；bundle/Redocly/Spectral 检查成功 |

C1 数据库回归分组：迁移 22、同步 9、模型原子性 5、关系并发 3、版本 16、查询语义 13。刻意继承 `--deselect` 和 `-k` 后仍完整执行 68 条；删去原家族发布用例的 67 条结果会被拒绝。现有五条 FastAPI/Starlette 弃用警告及 Node 颜色环境变量提示已分类为既有非阻断警告。

C2 的真实 RED 已保存：58 条采集/执行，34 条预期失败、24 条通过、零跳过；原 22 条迁移用例均保留并通过。新增失败复现了跨租户/跨家族引用、计划篡改、冲突覆盖及同前缀不同类型越界。首次 GREEN 为 69 条；浏览器复测随后发现默认 null 兼容问题，新增 RED 5 条、修复后覆盖测试 23 条通过。修复后重新执行全部必需回归，最终 123 条全部通过：迁移 77（原 22 + 新增 55）、同步 9、原子性 5、关系并发 3、版本 16、查询 13。

安全负例同时断言响应与实例（含 props/props_src）、overlay、mapping、迁移记录、关系、版本快照及模型的完整行快照不变。不同租户、不同家族与共享属性对象保持不变；合法家族成员即使不符合旧 RID 前缀也会迁移。负例 API 使用现有固定 RequestContext，属于认证上下文的数据库集成证据；真实 RS256 登录由浏览器流程另行覆盖。

字段冲突按键共存检测；相同值和 JSON null 也中止，避免推断已有值或来源可以丢弃。不存在自动合并或覆盖策略。

本轮代码验证对应 `22954b68`。受检 [用例结果](evidence/2026-10-08-metaplatform-r1/c2-final-outcomes.json)、[完整采集身份](evidence/2026-10-08-metaplatform-r1/c2-final-postgres.collection.json)、[浏览器结果](evidence/2026-10-08-metaplatform-r1/c2-browser-outcomes.json) 和 [安全浏览器清单](evidence/2026-10-08-metaplatform-r1/migration-browser-list.json) 仅包含用例身份与结果，不包含环境、连接密码或令牌。初始失败及中间结果保留在同目录，用于区分修复前后。

原始成功 JUnit 也已检查并保存：[数据库](evidence/2026-10-08-metaplatform-r1/ont-postgres.xml)、[RLS](evidence/2026-10-08-metaplatform-r1/ont-rls.xml)、[门禁行为](evidence/2026-10-08-metaplatform-r1/ci-gate-behavior.xml)、[浏览器](evidence/2026-10-08-metaplatform-r1/migration-browser.xml)；没有嵌入输出或环境数据。

最终可选 null 契约修复后的 [34 条契约测试](evidence/2026-10-08-metaplatform-r1/contract-tests.xml) 也已再次通过，15.82 秒、零跳过、无警告；不再仅依赖修复前的契约测试记录。

## 环境与资源隔离

| 用途 | 本次独立目标 | 角色 / 范围 |
| --- | --- | --- |
| 数据库回归 | `127.0.0.1:55483/metaplatform_ont_test`，`codex-c385-ont-r1-pg` | `mate_ont_test`，NOSUPERUSER / NOBYPASSRLS；跨租户回归种子库不启用 FORCE RLS |
| RLS 专项 | `127.0.0.1:55484/metaplatform_ont_test`，任务 native PostgreSQL | `mate_ont_test`，NOSUPERUSER / NOBYPASSRLS；九张核心表 FORCE RLS |
| 浏览器数据库 | `127.0.0.1:55484/codex_r1_ontology` | `codex_r1_app`，NOSUPERUSER / NOBYPASSRLS |
| 浏览器服务 | 前端 59250、gateway 58100、auth 58101、Ont 58007、Keycloak 55381、Redis 55379 | 本工作树源码；签名校验启用；公开测试 realm；不用现有业务服务 |

以上为测试时目标。完成验证后，本任务 native 进程和四个专用容器/匿名卷已清理，测试端口已关闭；本工作树、源码、锁定依赖、既有服务和其他工作树保留。原始成功 XML、清单及审查结论已移出临时任务目录并入库。

临时任务目录的递归删除被自动审批以 `blocked by policy` 拒绝，随后完成保留全部文件的可恢复归档：`.superpowers/archives/2026-10-08-metaplatform-r1-implementation`（Git 忽略）。没有删掉该目录的文件；活跃 SDD 目录已移出，历史本地工具/日志仍可恢复。

数据库角色、版本、扩展和 FORCE RLS 属性已通过只读 SQL 复核。辅助版本、迁移记录、overlay 和 mapping 表不在九表 FORCE RLS 清单内，迁移仍须显式过滤租户。浏览器使用 hash embedder，停用同步定时器；不覆盖外部 Provider、Neo4j v1 或 Agent 写入。

本地运行时为 Python 3.12.13、Node 26.3.0、pnpm 11.15.1；CI 配置使用 Node 22。本地浏览器通过不替代 Node 22 的远程 CI 结果；前端依赖采用 frozen lockfile 与 `--ignore-scripts` 安装，Chromium 可用，实际 Vite 已成功启动。

运行时镜像 Digest、native 文件来源及校验边界见 [来源摘要](evidence/2026-10-08-metaplatform-r1/runtime-sources.json)；实际数据库角色、版本、扩展和九表属性见 [只读环境查询](evidence/2026-10-08-metaplatform-r1/database-environment.json)。

Docker/WSL 曾超时并返回 500；仅停止本任务新建的 Neo4j/Keycloak 容器，未重启共享 Docker/WSL。另建 native PostgreSQL/Keycloak 完成真实测试；Docker 恢复后，回归改用 CI 对齐的 pgvector 目标。native PostgreSQL 16.15 运行时来自官方 EDB ZIP 的 bin/lib/share 项，按项校验 ZIP CRC；没有完整 ZIP 下载/哈希证据。Keycloak 25.0.6 来自官方发布 ZIP，完整 SHA256 已记录。无系统安装或既有服务改动。

## 复现入口

先按 [AGENTS.md](../../AGENTS.md) 安装锁定依赖。每次只使用独立数据库，显式配置连接；证据不记录连接密码或令牌。

从根目录执行数据库门禁，`PG_DSN` 与 `VER_PG_DSN` 指向同一 PostgreSQL 16 非特权业务连接：

```powershell
mate-platform-backend/.venv/Scripts/python.exe scripts/ci/verify_ont_postgres.py --junit .ci/ont-postgres.xml
```

FORCE RLS 使用另一个按专项脚本准备的独立库，追加 `--rls`。不要在回归种子库上临时开启 FORCE RLS。

浏览器先配置独立 `E2E_BASE_URL`、`E2E_GATEWAY` / `E2E_GATEWAY_URL`、`E2E_IAM_LOGIN_URL` 和 `VITE_BACKEND_PORT`，从前端目录执行：

```powershell
pnpm exec playwright test --config playwright.migration.config.ts --list --reporter=./migration-list-reporter.ts
pnpm exec playwright test --config playwright.migration.config.ts --workers=1
```

回到根目录，分别核对安全清单和实际 JUnit（两个选项互斥）：

```powershell
mate-platform-backend/.venv/Scripts/python.exe scripts/ci/verify_migration_browser.py --list metaplatform-frontend/test-results/migration-list.json
mate-platform-backend/.venv/Scripts/python.exe scripts/ci/verify_migration_browser.py --junit metaplatform-frontend/test-results/migration.xml
```

## 审查与后续

- C0：[独立任务审查](evidence/2026-10-08-metaplatform-r1/c0-review.md)通过；Git LF/CRLF 提示为非阻断格式通知。
- C1：初审发现逐条测试完整性缺陷；`473b9051` 修复后[独立复审](evidence/2026-10-08-metaplatform-r1/c1-fix-review.md)确认已解决，未引入新问题。
- C2：完成真实数据库及浏览器验证，[独立任务审查](evidence/2026-10-08-metaplatform-r1/c2-review.md) Approved，无未解决 Critical / Important。
- [全分支最终审查](evidence/2026-10-08-metaplatform-r1/final-review.md)：范围 `e965d866..d1e11382`，技术集成就绪（Ready to merge — Yes），没有集成前必修问题。后续仅登记审查结论、补存同一最终代码的契约测试 XML、临时资源清理及归档忽略规则，不改实现。
- R1 本地实现阶段的控制端判断：[字段共存时保守中止](evidence/2026-10-08-metaplatform-r1/rulings.md)，空值/同值场景可能需要人工处理；数据不自动覆盖。后续契约兼容性收紧的判断见[集成记录](2026-10-08-metaplatform-r1-integration.md)。
- 契约 lint 通过且无错误；Redocly 36 条、Spectral 100 条警告定位在迁移路径之外，没有独立重跑历史基线来证明相同数量。锁定 npm 依赖安装产生的弃用提示也已记录；没有改依赖/锁文件。
- 本地收口时尚未执行远程 GitHub CI；随后已授权推送并创建 PR #96，实际结果和集成修复见[集成记录](2026-10-08-metaplatform-r1-integration.md)。分支保护未更改；本地绿色不是远程合并准入证明。
- 部署、业务验收与试点：未执行。模型回滚仍只恢复模型，不恢复迁移数据。
- 下一轮 R2：按路线图 C3/C4 完成发布—迁移—持续同步、数值精度与组合步骤；R3 再验收命令重放/并发；完整迁移试点以前置轮次为准。

六个既有主服务的启动时间与健康快照在本轮后段再次核对一致，见 [记录](evidence/2026-10-08-metaplatform-r1/shared-services.txt)；本次只重载独立 Ont API，未重启既有服务。
