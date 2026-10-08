# MetaPlatform Builder V2 本地验收与复现

更新：2026-10-09（Asia/Shanghai）。**状态：验收进行中，未满足全部退出条件。** 本文只登记当前工作树的源码、实际执行与明确边界，不声明 PR/主干 CI、部署、业务验收或 GA。运行回执必须与下表的 source commit 对应；早期绿色结果不能替代最终运行。

## 范围与源码

- 已接受输入：[设计](../superpowers/specs/2026-10-08-metaplatform-builder-v2-alignment-design.md)、[实施计划](../superpowers/plans/2026-10-08-metaplatform-builder-v2-alignment.md)。最新 HTML 的七入口、全平台布局与现有后端范围为用户已批准范围。原型合成客户、假角色、假同步/发布快照及无契约操作不进入正式业务链。
- 工作树：`C:/Users/houuu/.codex/worktrees/242e/2026-07-02-MetaPlatform`；分支 `codex/metaplatform-builder-v2`；基线 `9646f018`；最后已审查实施源码 **`8df5ba95b3b07bd2721a16ddbdc9f7b75681ff00`**，tree **`b937cab8b2848a4c9af5f656a66c05442bac9079`**。证据提交单独产生，不递归把自身作为实施源码。
- Task 5 全包审查发现的两个 Important 已在 `8df5ba95` 修复；限定差异的规格/质量复审 Approved。全分支最终只读审查由控制器执行，当前待完成。
- [active 页面清单](../active/acceptance/builder-v2-active-page-coverage.md) 分类 **151 个 active 路由模式、132 个直接解析唯一页面源**（150 条直接解析加 `/ontology` wrapper 人工核对）；123 个 redirect 为兼容声明。清单是源页面/共享 PageHeader、表格、卡片与状态模式采用证据，**不是 151 页面逐一浏览器验收**。query/RID/tab 实例不无限扩展；Apphub 的 15 个 query 子页继续由既有 wrapper 分发。
- 代表浏览器配置显式选择 IA、Ont Builder、平台 Builder 三个文件，21 个身份；覆盖七入口、常驻 SuperAI、功能组、页面导航、深链、历史、普通 Tab/Escape 和偏好。真实 Ont 与其他服务的 HTTP 替身分别登记。

## 当前门禁账本

安全回执在 [evidence 目录](evidence/2026-10-08-metaplatform-builder-v2/README.md)。缺回执、失败、环境 skip 或尚未执行都不记为通过。

| 范围 | 当前最终状态 | 源码与实际数量 | 证据口径 |
|---|---|---|---|
| 全前端 unit | 通过 | `8df5ba95`；233 执行 / 233 通过 / 0 failure / 0 error / 0 skip；699 源文件前后指纹一致 | [unit.json](evidence/2026-10-08-metaplatform-builder-v2/unit.json)，本地组件/请求边界证据 |
| 最终 typecheck / build | 通过 | `8df5ba95`；两项 exit 0，699 源文件前后指纹一致 | [typecheck.json](evidence/2026-10-08-metaplatform-builder-v2/typecheck.json)、[build.json](evidence/2026-10-08-metaplatform-builder-v2/build.json)；后续仅浏览器/helper 修订须核对源是否变化 |
| 原六组 PostgreSQL 回归 | 未通过；待重跑 | 最新完整尝试 `eb2eeacd`，123 执行 / 122 通过 / 1 setup OperationalError / 0 skip；1419 后端 PY/SQL 指纹一致 | [postgres-latest-failed.json](evidence/2026-10-08-metaplatform-builder-v2/postgres-latest-failed.json)，连接意外关闭；不是最终绿色门禁 |
| 原 ontology core | 待最终执行 | 9 个原用例 | 原 core 项目、完整采集，不筛选 |
| 原 migration | 待最终执行 | 2 个原用例 | 专用配置和安全 list/JUnit 核对；不删除/替换原断言 |
| Builder / 受影响 IA | 待最终执行 | 21 个当前身份 | 先采集，再核对执行身份、零失败/跳过；旧成功 21 及后续登录失败均保留 |
| 四尺寸截图 | 待最终执行/检查 | Ont 五页 × 四尺寸 = 20；平台八代表页 × 四尺寸 = 32 | 内容 ready、实际身份/个人设置、像素/溢出/交互分别核对；壳截图不替代页面内容 |
| 契约工具 | 待最终回执 | 任务局部已有检查；最终统一检查待登记 | 采用 contracts 自身 package-lock 与脚本 |
| 全分支最终审查 | 待完成 | 实施源码与独立证据包 | 所有 Critical/Important 关闭才满足退出条件 |

早期 PG 123/123、core 9/9、migration 2/2 是旧源码基线，不能填充本表。PG 曾有预检连接失败、122/123 的 fixture connection error、122/123 的 legacy interface assertion，以及上述另一 setup case 的 unexpected connection close；失败尝试完整保留在忽略的私有运行区。原 focused 查询重跑曾通过 1/1，不能替代完整六组回归。安全检查没有发现已确认的服务重启/OOM/PANIC 原因，接口读取错误是否关联该 assertion 未证实。Windows 端口转发/传输只是调查方向，**没有确认根因**。

Builder 旧完整 21/21 后曾出现 14 通过/7 失败及 16 通过/5 失败；失败发生在登录前置（504/504/504），未达到产品断言。现有 builder-only helper 对 502/503/504 最多三次尝试并逐项记录 HTTP 状态；401/403/422、缺身份或断言失败不重试成绿色、不 skip。其它错误 selector/DTO 假设和被拒绝的 RID 尝试也保留，正向 fixture 修正不算产品问题已修复。

## 真实链路与 HTTP 边界

真实目标为本轮独立 PostgreSQL 16、Keycloak、Redis、native 当前源码 IAM/Auth、gateway、Ont 和当前源码 Vite。签名校验开启；浏览器实际 login/UserInfo-backed ID、签名 tenant 与匹配 `userId` 的个人设置请求/响应才能建立个人会话、应用主题。当前签名 JWT 缺 `sub`/`realm_access` 时不制造 ID 或管理员角色。实际 SharedLoginPage 无预置 storage/无 HTTP stub 的登录探针与只读 page capture 的真实登录后注入会话，是两种独立证据；后者不称为 UI 登录操作。

新增真实写入用例 `real Ont + own PG: editor WIP, five-step publication, saved source sync and actual sample query` 没有 `page.route` 拦截。它通过实际 UI：只读 precheck → WIP save/服务端回读 → validation → GET 404 核实全新目标 → 实际 `confirm_with` apply → 不可变版本/checksum 当前生效回读 → 普通 backing source 完整属性 RID 映射 upsert/回读 → 全量 sync → materialization 两行 → explorer 同 class 两行/完整属性值。只允许六种实际 POST：precheck、WIP save、validate、apply、source save、sync。全量 sync body `{}` 使用现有可选 incremental 的 false 默认值，成功结果为 synced 2 / failed 0 / deleted 0。唯一 `src_builder_e2e_*` 源表由实际非特权 fixture 角色新建、参数绑定两行；不 DROP、不复用既有表，测试模型/WIP/源表保留在隔离目标。**当前源码最终执行回执尚待控制器提供。** 模型发布不等同于实例迁移、回滚或 Proposal 执行，原 core/migration 单独核对。

非本体域使用 [platform-boundary.ts](../../metaplatform-frontend/apps/web/tests/e2e/helpers/platform-boundary.ts) 人工编写的当前 DTO HTTP 替身：

| 路径 | 替身响应/行为 |
|---|---|
| `GET /api/v1/dashboard/page/summary` | HTTP 边界统计、空任务/健康/员工及继续建模链接；不代表实际运营统计 |
| `GET /api/v1/dashboard/todos` | 首次 503，retry 后成功空分页 |
| `GET /api/v1/apphub/apps` | 单个明确标注 HTTP 边界的应用目录 |
| `GET /api/v1/apphub/apps/groups`、`/domains` | 各首次 503，retry 后人工 business/orders DTO |
| `GET /api/v1/dw/employees` | 一个实际契约枚举 `ACTIVE` 的人工员工目录 DTO |
| `GET /api/v1/copilot/conversations`、`/conversations/conv-boundary/messages` | 人工会话与 user 消息，验证既有页面消费行为 |
| `GET /api/v1/copilot/models/chat`、`/models/multimodal` | 明确空模型 DTO，无模型推理/工具执行 |
| IAM 与 Ont 路径 | 继续真实网络请求 |
| `GET/PUT /api/v1/dashboard/settings` | 当前 `8df5ba95` 的宽域替身会落入未登记 503；独立 capture 的真实 settings 证明单独登记；不能将此平台用例称为远端 settings 成功 |
| 其余非本体调用 | 明确 503 未登记边界；知识/治理页展示 unavailable，不暗示真实服务运行 |

辅助读失败的专门 Ont UI 用例另外拦截已标注的读请求以验证 partial/unavailable，不能混算为正常真实 Ont 链。HTTP 替身的目录/审批错误重试、KB 不吞失败、治理 unavailable 和 SuperAI DTO 页面只证明前端行为，不证明这些独立业务服务的集成/执行。

Task 6 边界审查发现上述 settings 拦截与 helper 注释/用例标题“real signed settings”不一致，已交控制器实施/复审；本证据任务不改业务或原用例。当前该用例只能证明本地偏好 fallback/reload，不计入最终远端偏好退出条件，后续源码/回执到齐再更新。

## 四项 Ruling 与继承限制

按执行时间排序，保留决策理由与代价：

1. **浏览器历史输入保留（Task 2）**：既有 BrowserRouter 不转换为 data router/不改历史内部实现。back/forward 允许导航，按真实 user/tenant/resource 隔离的会话内完整编辑副本、未提交提示、返回恢复及 beforeunload 防止静默丢失；保存/主动丢弃/身份改变清除。代价：结束浏览器会话不能恢复原始输入，副本不等于服务端 WIP，导航不是每次都被取消。
2. **UserInfo 故障不制造身份（Task 10）**：保留现有最佳努力 HTTP 200/SUCCESS、DTO、token 与签名/租户守卫；dashboard 与 IAM 一致缺 subject 时返回空 ID，不再 `u-{username}`。UI 拒绝缺 ID 个人会话。代价：依赖旧派生 ID 的消费者在 provider 故障时必须重试登录；有效 provider 身份兼容，不扩大角色权限。
3. **已加载自定义水位绑定不可编辑保存（Task 3）**：当前 save DTO 不提供 `ts_column`，repository upsert 会将省略值覆盖为 `updated_at`。检测实际加载的 custom watermark 后阻止保存、保留输入并解释限制；读取/物化/已保存配置同步和明确新建另一来源仍可用，普通/新来源可保存。代价：这些绑定的修改须等待已接受的保留配置 API，不能只提示后静默重置；本轮无后端水位新语义。
4. **CI-only 非特权源 fixture（Task 5）**：仅 ephemeral ontology-loop job 新建 `builder_source_fixture`，`NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`，显式本 job DB/schema 的 CONNECT/USAGE/CREATE；生成并 mask 密码，PG env 仅此 step；新增显式 `CI=true` loopback5432/metaplatform_ont/该角色 allowlist，实际 case 复核四标志。代价：新 CI setup 可能失败，须实际 CI 成功后才宣称通过；不改全局 init、生产角色、本地预览或存量数据。当前只有配置/源码验证，没有 CI 运行。

现有服务缺少 **saved-WIP revision 原子前置条件**。前端 exact reread、stored base 与本地 generation/独立 pending lock 可阻止已观测陈旧结果及请求中重复提交，但不能排除 reread 与 apply 之间的并发 WIP 替换。本轮未新增未接受的后端事务协议。另有 **RID grammar 不一致**：ClassRef/editor 接受的下划线 fixture 被现行 validation `_RID_RE` 判为 `valid:false`，UI 正确阻止 apply。通过 fixture 改用共同接受的 hyphen slug；该既有下划线边界没有修复，不能称所有合法编辑 RID 均可发布。

源列元数据/源样本预览、原型审批配置/沙箱或假执行若现行 API 不支持不开放；物化样本不是源样本。不变版本/current checksum 是模型事实；模型回滚不承诺实例恢复或外部副作用补偿。Neo4j legacy v1 未启动；embedder 为 hash、function backend 为 local subprocess，不外推远端模型/运行沙箱能力。

## 工具链、准备与复现

2026-10-09 当前源码安全版本/锁指纹见 [toolchain.json](evidence/2026-10-08-metaplatform-builder-v2/toolchain.json)：Python 3.12.13、Node 22.23.3（官方 SHA256 校验）、pnpm 11.15.1、uv 0.12.0；FastAPI 0.140.4、Starlette 1.3.1、uvicorn 0.51.0、httpx 0.28.1、psycopg 3.3.4、pytest 9.1.1。全局 Node 26 曾触发无关 jsdom localStorage 环境错误，当前 gates 用上述 Node22 first PATH。版本记录本身不是测试通过证据。

按根 AGENTS 在当前工作树执行 frozen `uv sync --python 3.12 --package mate-tech-ont --no-install-workspace`、导出 workspace dev group 并安装到本 .venv；前端 `pnpm install --frozen-lockfile --ignore-scripts`。后端 uv.lock、前端 pnpm-lock.yaml、contracts package-lock.json 为各工作区来源，根同名锁不替代。本轮依赖已准备并实际运行 unit/浏览器/build；native rebuild/Chromium 准备命令明细仍待控制器补充，不能以可启动浏览器推断所有准备步骤均成功。不要运行移除锁的 install:clean。

[独立本地验证入口](../../scripts/ci/run_builder_v2_validation.ps1) 与 [Python 实现](../../scripts/ci/run_builder_v2_validation.py) 消费 caller 的 private 环境输入，不读取/输出 compose 或私有配置，不 provision/restart/stop/free-port/reset/delete。它验证指定 PG 容器的 goal/project/loopback ownership、实际 PG16/角色与四非特权标志；拒绝默认共享 DB/服务地址。只生成 Git ignored 私有原始诊断和严格安全回执，source 前后指纹不一致或缺用例/失败/skip 则失败。原有 core/migration 配置通过运行区临时 overlay 移除 webServer 生命周期，保留原项目/文件/断言，不筛选必需 cases。

调用前自行在本地私密会话设置 `PG_DSN` 和相同 `VER_PG_DSN`（`127.0.0.1:55493/metaplatform_ont_test`、`mate_ont_test`）。浏览器同时需要显式 `E2E_BASE_URL=http://127.0.0.1:59260`、`E2E_GATEWAY_URL` 和 `E2E_GATEWAY=http://127.0.0.1:58110/api/v1`、`E2E_IAM_LOGIN_URL=http://127.0.0.1:58110/api/v1/iam/auth/login`，以及 `PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD` 指向本轮 `127.0.0.1:55493/codex_builder_ontology/builder_app`。不要将密码、DSN 值、JWT 或完整 environment 回显、写入报告或 Git。既有源码 helper 的公开演示登录 fixture 不代表生产账户；正式复现需本轮已配置的独立 provider。

```powershell
# 从仓库根目录；private 环境输入已在本地设置，不写在命令/文档中
$source = '8df5ba95b3b07bd2721a16ddbdc9f7b75681ff00'
./scripts/ci/run_builder_v2_validation.ps1 -Mode preflight -SourceCommit $source
./scripts/ci/run_builder_v2_validation.ps1 -Mode postgres -SourceCommit $source
$node = (Resolve-Path '.superpowers/runtime/node22/package/bin/node.exe').Path
$pnpm = Join-Path $env:APPDATA 'npm/node_modules/pnpm/bin/pnpm.cjs'
./scripts/ci/run_builder_v2_validation.ps1 -Mode core -SourceCommit $source -NodePath $node -PnpmPath $pnpm
./scripts/ci/run_builder_v2_validation.ps1 -Mode migration -SourceCommit $source -NodePath $node -PnpmPath $pnpm
./scripts/ci/run_builder_v2_validation.ps1 -Mode builder -SourceCommit $source -NodePath $node -PnpmPath $pnpm
```

入口的原始 PG 操作为 `mate-platform-backend/.venv/Scripts/python.exe scripts/ci/verify_ont_postgres.py --junit <new ignored run>/results.xml`，仍由原 gate 完整采集六组/逐条核对执行身份。原 migration 为 `pnpm exec playwright test --config playwright.migration.config.ts --list --reporter=./migration-list-reporter.ts` 和 `--workers=1`，安全清单/JUnit 分别交 `scripts/ci/verify_migration_browser.py --list/--junit`；Builder 对应 `playwright.builder.config.ts`、`builder-safe-reporter.ts` 与 `scripts/ci/verify_builder_browser.py --list <builder-list.json> --junit <builder.xml>`。root 最终实跑采用既有忽略区 controller wrappers，命令/config/hash 由其最终安全回执补充；新增公共入口目前只有语法/help检查，**未冒称它已运行上述 gates**。

前端原始 gates 从 `metaplatform-frontend` 用 Node22 first PATH 执行 `pnpm --filter @mate/web exec vitest run`、`pnpm --filter @mate/web typecheck`、`pnpm --filter @mate/web build`。contracts 从其独立目录执行锁定依赖工具 `npm run check` 及当前 contract pytest；完整原始输出只留忽略目录。

## 视觉取证与保留

尺寸：1440×1000、1920×1080、1024×900、390×844。最终模型图必须真实模型/Inspector ready；类型页完成实际属性/关系/绑定读取；映射页实际类型与 binding/materialization settle；query 页实际结果 settle；release 页实际 WIP/versions 完成、publication/current-live 可见且 draft loader 隐藏。所有页面先核对成功匹配个人设置及应用主题；不能只等 networkidle。每张记录 source、页面/尺寸/ready 判据、真实/HTTP边界、pageerror/API failure 与 document overflow。最终像素检查另记交互，不能把无 document overflow 等同于所有局部控件可操作。

390px SuperAI 输入工具条需窄屏 **native local-scroll reachability** 探针：实际打开边界会话、定位工具条滚动容器、记录 scroll/client width，真实键盘焦点或横向滚动到末端并检查目标可见/可操作。单张 clipping 截图不能证明不可达；未交互前结论待定。发现业务 bug 交控制器，不在证据任务修改业务源码。

本轮预览 [http://127.0.0.1:59260](http://127.0.0.1:59260) 保留。独立 ports：gateway58110、auth58111、Ont58017、PG55493、Keycloak55389、Redis55387；容器 `codex-242e-builder-v2-*`，goal `01a11b4d-ab28-7ed0-9a89-929e5fae1374`。不使用/重启其它工作树、共享服务或 DB，不释放端口。Docker host source-mount 曾 ENOMEM，仅本轮已确认拥有的 API 尝试停止；当前 native source，不能以旧 image 版本冒称当前源码。

最终安全证据入 Git 后，控制器将仍需的 helper/private runtime 复制到 Git ignored `.superpowers/runtime/builder-v2`，逐个验证 absolute 源/目标路径和文件 allowlist、更新 helper 路径且不重启预览。compose/private config/raw log/auth-state/HAR/trace 不入公共证据；不删除现存工作树，不 reset/prune/remove/递归清理共享资源。一次 helper 源读取意外显示了源码公开演示 fixture 字面量，未读取/持久化 private-config、JWT 或私人环境值；后续只做内部字段 allowlist 提取。
