# MetaPlatform 接管入口

> 2026-10-08：用户指定当前 `2026-07-02-MetaPlatform` 仓库作为研发依据。

## 工作范围与单源

- 在当前隔离工作树工作；先执行 `git status --short`、`git branch --show-current`、`git worktree list`，确认目录、分支及在途修改。R1 工作树为 `C:\Users\houuu\.codex\worktrees\c385\2026-07-02-MetaPlatform`，分支为 `codex/metaplatform-r1`。
- 当前任务及退出条件：[R1 实施计划](docs/superpowers/plans/2026-10-08-metaplatform-r1-implementation.md)；后续依赖：[已接受路线图](docs/superpowers/plans/2026-10-08-metaplatform-optimization-roadmap.md)。
- 模型迁移以 [ADR-0082](docs/active/decisions/ADR-0082-ontology-migration-plan.md)、草稿/版本以 [ADR-0080](docs/active/decisions/ADR-0080-ontology-draft-and-version-mechanism.md) 为单源；API 契约为 [ont.yaml](mate-platform-backend/contracts/openapi/services/ont.yaml)。
- 平台目标与产品范围分别以 [联邦数字员工架构](docs/superpowers/specs/2026-08-31-federated-digital-employee-platform-design.md)、[产品模块规格](docs/superpowers/specs/2026-09-01-metaplatform-product-modules-design.md) 为单源，保留源文档的条件性基线/待书面评审状态；存量 [实施基线](docs/active/specs/2026-07-27-mate-platform-architecture-implementation.md) 按后续已接受 ADR/规格覆盖。其他规格通过 [文档索引](docs/README.md) 定位；发生冲突停止受影响实现，先修订 ADR/规格，再同步入口。
- 2026-09-08 指向 `MetaPlatform-Ontology` 的迁移决定是历史记录。当前构建、测试、运行和设计依据为本仓库；不依赖或修改另一仓库。`CLAUDE.md` 中旧验收数字、服务地址及交接批次只代表其注明日期的历史记录。

## 安装与验证入口

后端使用 Python 3.12 与 [后端 uv.lock](mate-platform-backend/uv.lock)，前端使用 Node 22 与 [前端 pnpm-lock.yaml](metaplatform-frontend/pnpm-lock.yaml)。配置分别在 [后端 pyproject.toml](mate-platform-backend/pyproject.toml)、[前端 package.json](metaplatform-frontend/package.json) 和 [web package.json](metaplatform-frontend/apps/web/package.json)；不要误用仓库根目录的同名锁文件替代这两个工作区的锁文件。

以下 PowerShell 命令从仓库根目录开始，安装只作用于当前工作树。`--no-install-workspace` 配合后端 pytest 的源码 `pythonpath`；锁定的 dev 依赖从工作区导出，因为 `mate-tech-ont` 自身没有 dev group。

```powershell
Set-Location mate-platform-backend
uv sync --frozen --python 3.12 --package mate-tech-ont --no-install-workspace
uv export --frozen --only-group dev --no-hashes --no-emit-workspace --output-file .venv/r1-dev-requirements.txt
uv pip install --python .venv/Scripts/python.exe -r .venv/r1-dev-requirements.txt
Set-Location ../metaplatform-frontend
pnpm install --frozen-lockfile --ignore-scripts
Set-Location ..
```

前端原生构建准备参考 [ontology-loop CI](.github/workflows/ontology-loop.yml) 的依赖安装步骤（`pnpm rebuild puppeteer esbuild`、Chromium 安装）。不要运行会移除锁文件的 `install:clean`；本地验证的实际依赖准备结果须记录。

| 验证范围 | 当前源码入口 |
| --- | --- |
| 迁移/版本数据库回归 | 从 `mate-platform-backend` 用 `.venv/Scripts/python.exe -m pytest packages/mate-tech-ont/tests/integration/test_ont_migration_plan.py packages/mate-tech-ont/tests/integration/test_ont_version_mechanism.py -q`；执行前显式设置 `VER_PG_DSN` 为本次独立 PostgreSQL 目标 |
| 后端治理/非特权 RLS | [ga-acceptance.yml](.github/workflows/ga-acceptance.yml)；[verify_ont_rls.sh](scripts/ci/verify_ont_rls.sh)（仅对独立数据库设置 `ONT_RLS_ADMIN_DSN` / `PG_DSN`） |
| 前端类型/构建 | 从 `metaplatform-frontend` 执行 `pnpm --filter @mate/web typecheck`、`pnpm --filter @mate/web build` |
| 浏览器核心闭环 | [Playwright 配置](metaplatform-frontend/playwright.config.ts)、[ontology-loop CI](.github/workflows/ontology-loop.yml)；独立服务和端口由 R1 计划定义 |
| 迁移浏览器用例 | [ontology-migration-plan.spec.ts](metaplatform-frontend/apps/web/tests/e2e/ontology-migration-plan.spec.ts) 位于根 Playwright `testDir` 之外；R1 C1 必须显式采集并执行，不能把根核心闭环通过视为迁移用例通过 |

## 实施与证据约束

- 保留运行服务、数据库、用户修改及所有现存工作树；禁止用清理、重置或共享端口测试破坏它们。本轮测试只使用本轮独立资源，清理也只作用于这些资源。
- 提交顺序：docs/ADR → contract → failing tests → feature → infrastructure → deploy → acceptance evidence；使用 Conventional Commits，PR 引用相关 ADR、operationId 与证据。
- 遵守 [13 条硬规则与对应门禁](docs/active/governance/HARD-RULES-MATRIX.md)。文档/索引更改检查链接、命令和差异，不编写镜像实现的测试。
- 必需数据库和浏览器用例须实际采集执行；缺连接、环境性 skip、`NOT_EXERCISED` 都不能记为通过。分别登记本地、PR/主干 CI、部署与业务验收证据；历史 Accepted 不能代替当前 R1 验证。
- Python 缓存与 `.worktrees/` 是本地生成物。确认后仅用 `git rm --cached` 取消误跟踪，保留文件与工作树；不得运行 `git worktree remove`、`prune` 或递归删除来完成索引卫生。
