# MetaPlatform Builder V2 本地验收与复现

更新：2026-10-09（Asia/Shanghai）。**状态：验收进行中，未满足全部退出条件。** 本文只登记当前工作树的源码、实际执行与明确边界，不声明 PR/主干 CI、部署、业务验收或 GA。运行回执必须与下表的 source commit 对应；早期绿色结果不能替代最终运行。

## 范围与源码

- 已接受输入：[设计](../superpowers/specs/2026-10-08-metaplatform-builder-v2-alignment-design.md)、[实施计划](../superpowers/plans/2026-10-08-metaplatform-builder-v2-alignment.md)。按用户选择保留七入口，布局参考更新 HTML（其自身为八入口）；全平台布局与现有后端范围为用户已批准范围。原型合成客户、假角色、假同步/发布快照及无契约操作不进入正式业务链。
- 工作树：`C:/Users/houuu/.codex/worktrees/242e/2026-07-02-MetaPlatform`；分支 `codex/metaplatform-builder-v2`；基线 `9646f018`；当前稳定实施源码 **`f892895200d57312fbb753866271d82f4d52af83`**，tree **`c72290d13930885ca6c2fe990b7c80999d8a9f3f`**。证据提交单独产生，不递归把自身作为实施源码。
- Task 5 两轮 Important/设置取证修复已分别在 `8df5ba95`、`158ab236` 限定复审 Approved。最终整分支审查 `9646f018..158ab236` 发现两个 Important/P2（命令锁可重置/父子发布命令未协调，跨域/legacy 同 family 当前版本标记）；唯一实施修复 `f8928952` 统一同步命令锁和 canonical tenant+terminal-slug family。唯一限定最终复审 `158ab236..f8928952` 的规格/质量均 Approved，两项 P2 关闭、无新 Critical/Important；控制器已确认。源码审查通过与最终运行退出分开，[review.json](evidence/2026-10-08-metaplatform-builder-v2/review.json) 不认证尚未完成的浏览器/视觉、CI 或部署。
- [active 页面清单](../active/acceptance/builder-v2-active-page-coverage.md) 分类 **151 个 active 路由模式、132 个直接解析唯一页面源**（150 条直接解析加 `/ontology` wrapper 人工核对）；123 个 redirect 为兼容声明。清单是源页面/共享 PageHeader、表格、卡片与状态模式采用证据，**不是 151 页面逐一浏览器验收**。query/RID/tab 实例不无限扩展；Apphub 的 15 个 query 子页继续由既有 wrapper 分发。
- 代表浏览器配置显式选择 IA、Ont Builder、平台 Builder 三个文件，21 个身份；覆盖七入口、常驻 SuperAI、功能组、页面导航、深链、历史、普通 Tab/Escape 和偏好。真实 Ont 与其他服务的 HTTP 替身分别登记。

## 当前门禁账本

安全回执在 [evidence 目录](evidence/2026-10-08-metaplatform-builder-v2/README.md)。缺回执、失败、环境 skip 或尚未执行都不记为通过。

| 范围 | 当前最终状态 | 源码与实际数量 | 证据口径 |
|---|---|---|---|
| 全前端 unit | 通过 | `f8928952`；240 执行 / 240 通过 / 0 failure / 0 error / 0 skip；701 源文件前后指纹一致 | [unit.json](evidence/2026-10-08-metaplatform-builder-v2/unit.json)，本地组件/请求边界证据 |
| 最终 typecheck / build | 通过 | `f8928952`；两项 exit 0，701 源文件前后指纹一致 | [typecheck.json](evidence/2026-10-08-metaplatform-builder-v2/typecheck.json)、[build.json](evidence/2026-10-08-metaplatform-builder-v2/build.json) |
| 原六组 PostgreSQL 回归 | 通过，后端字节适用当前源 | `158ab236` 实际完整 123 执行 / 123 通过 / 0 failure / 0 error / 0 skip；1419 后端 PY/SQL 前后指纹一致，`158..f892` backend/gate/contract 未变 | [postgres.json](evidence/2026-10-08-metaplatform-builder-v2/postgres.json)、[源适用性核对](evidence/2026-10-08-metaplatform-builder-v2/source-applicability.json)；不伪称在 f892 重跑 |
| 原 ontology core | 通过 | `f8928952`；公共入口实际 9/9，零 failure/error/skip；2220 源文件前后指纹一致 | [public-core.json](evidence/2026-10-08-metaplatform-builder-v2/public-core.json)；原 helper 身份 fallback 限制仍保留 |
| 原 migration | 通过 | `f8928952`；修复后公共入口实际 2/2，零 failure/error/skip，canonical auditor exit0 | [public-migration.json](evidence/2026-10-08-metaplatform-builder-v2/public-migration.json)；保留先前公共 parser 身份失败 |
| Builder / 受影响 IA | 通过 | `f8928952`；原完整 21/21，零 failure/error/skip，128.641s；701 文件指纹一致，21 精确身份核对 exit0 | [builder.json](evidence/2026-10-08-metaplatform-builder-v2/builder.json)；控制器原 runner 实跑，不冒称新公共入口 Builder 已运行 |
| 四尺寸截图 | 52 named-ready 视图已采集并像素检查；窄屏交互未完成 | Ont20 + 平台代表32；另保留原 Builder gate32 和失败8图 | [清单](evidence/2026-10-08-metaplatform-builder-v2/screenshot-manifest.json)、[像素检查](evidence/2026-10-08-metaplatform-builder-v2/visual-inspection.json)、[未达交互](evidence/2026-10-08-metaplatform-builder-v2/narrow-interaction.json)；不以无整页溢出认证所有局部控件 |
| 契约工具 | 通过，字节适用当前源 | 控制器在 `158ab236` 实际 contract 7/7、validate_contracts exit 0；`158..f892` backend/contract/gate 未变 | [contracts.json](evidence/2026-10-08-metaplatform-builder-v2/contracts.json)；JUnit 7 项安全投影，validator exit 来源为控制器确认而非本证据 Agent 重跑 |
| 全分支最终审查 | 源码 findings 已关闭；运行条件保留 | 整分支首审加唯一限定最终修复复审，两 P2 addressed；规格/质量 Approved | [review.json](evidence/2026-10-08-metaplatform-builder-v2/review.json)；合入评估 conditional，未认证最终运行/证据退出 |

早期 PG 123/123、core 9/9、migration 2/2 是旧源码基线，不能填充本表。上述 PG 绿色来自新的完整原六组运行（migration77、sync9、atomic5、cardinality3、versions16、query13），collection/JUnit 由原 gate 逐条核对，耗时 242.203s。当前公开回执保留真正执行的 `158ab236` source，而以只读后端 1419 文件指纹与空 diff 证明对当前 f892 字节适用。

PG 先前有预检连接失败、122/123 的 fixture connection error、122/123 的 legacy interface assertion，以及另一 setup case 的 unexpected connection close；[先前失败投影](evidence/2026-10-08-metaplatform-builder-v2/postgres-latest-failed.json) 与完整私有失败尝试均保留。原 focused 查询 1/1 没有替代完整回归。最终同一独立 DB/角色以显式 `sslmode=disable/gssencmode=disable` 运行；之前 prefer/disable 实际连接均 SSL=false，这不是 TLS 降级或 SSL 根因证据。安全检查没有确认服务重启/OOM/PANIC 原因，接口读取错误是否关联 assertion 未证实。Windows 端口转发/传输只是调查方向，**没有确认根因**。Linux container runner 尝试在 ownership inspect 500 前失败，没有创建/执行该 gate；没有重启共享 Docker Desktop/WSL。

外部状态一度恢复，真实 IAM200 后完成当前 core9、migration2、Builder21 与52视图。随后只读窄屏探针两次前 UI provider 失败，最后一次授权 bounded retry 严格登录仍504；停止重试、无服务变更。先前同 CID Keycloak/IAM504 与 CreateProcess policy拒绝JWKS探针保留历史，不证明根因或永久恢复。Task6仍缺实际窄屏交互和最终证据复审，不能宣布全部退出条件完成。

Builder 旧完整 21/21 后曾出现 14 通过/7 失败及 16 通过/5 失败；失败发生在登录前置（504/504/504），未达到产品断言。现有 builder-only helper 对 502/503/504 最多三次尝试并逐项记录 HTTP 状态；401/403/422、缺身份或断言失败不重试成绿色、不 skip。其它错误 selector/DTO 假设和被拒绝的 RID 尝试也保留，正向 fixture 修正不算产品问题已修复。

## 真实链路与 HTTP 边界

真实目标为本轮独立 PostgreSQL 16、Keycloak、Redis、native 当前源码 IAM/Auth、gateway、Ont 和当前源码 Vite。签名校验开启；浏览器实际 login/UserInfo-backed ID、签名 tenant 与匹配 `userId` 的个人设置请求/响应才能建立个人会话、应用主题。**新增 Builder strict helper、实际 SharedLoginPage 与 capture** 在当前签名 JWT 缺 `sub`/`realm_access` 时不制造 ID 或管理员角色。原 core/migration 的既有 auth helper 仍保留 claims 缺失时派生 ID、默认角色的 fallback；保留原 helper 和断言不改，因此这些原 suite 即使通过，也不能单独认证实际个人身份或角色授权，须以 UserInfo-backed Builder/UI 证据另行核对，未执行的 suite 不记为通过。实际 SharedLoginPage 无预置 storage/无 HTTP stub 的登录探针与只读 page capture 的真实登录后注入会话，是两种独立证据；后者不称为 UI 登录操作。

新增真实写入用例 `real Ont + own PG: editor WIP, five-step publication, saved source sync and actual sample query` 没有 `page.route` 拦截。它通过实际 UI：只读 precheck → WIP save/服务端回读 → validation → GET 404 核实全新目标 → 实际 `confirm_with` apply → 不可变版本/checksum 当前生效回读 → 普通 backing source 完整属性 RID 映射 upsert/回读 → 全量 sync → materialization 两行 → explorer 同 class 两行/完整属性值。只允许六种实际 POST：precheck、WIP save、validate、apply、source save、sync。全量 sync body `{}` 使用现有可选 incremental 的 false 默认值，成功结果为 synced 2 / failed 0 / deleted 0。唯一 `src_builder_e2e_*` 源表由实际非特权 fixture 角色新建、参数绑定两行；不 DROP、不复用既有表，测试模型/WIP/源表保留在隔离目标。**当前完整Builder21已执行通过，真实链路在其中实际成功，源表/模型/偏好恢复按原用例执行。** 模型发布不等同于实例迁移、回滚或 Proposal 执行，原 core/migration 单独核对。

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
| `GET/PUT /api/v1/dashboard/settings` | `158ab236` 修复后仅精确路径 GET/PUT 放行真实服务；POST、子路径及未知 dashboard 调用仍 503。当前 f892 相同 helper/用例字节 |
| 其余非本体调用 | 明确 503 未登记边界；知识/治理页展示 unavailable，不暗示真实服务运行 |

辅助读失败的专门 Ont UI 用例另外拦截已标注的读请求以验证 partial/unavailable，不能混算为正常真实 Ont 链。HTTP 替身的目录/审批错误重试、KB 不吞失败、治理 unavailable 和 SuperAI DTO 页面只证明前端行为，不证明这些独立业务服务的集成/执行。

Task 6 曾发现旧 settings 拦截与 helper 注释/标题“real signed settings”不一致，旧完整 20/21 中该用例的远端 settings pass 归因明确撤回。Task 5 原实施者只修复两个 E2E 路径、限定复审 Approved；同一个原用例 focused GREEN 1 项在真实 provider-backed ID 下核对初始 GET200、精确主题 PUT200、reload GET200 的服务器持久值，并在 finally 恢复原完整服务器偏好/验证 GET，恢复本地导航选择。基线 replay 的有意义 RED 为登录200后 settings503；此前登录504三次不能充当 RED。`mp_nav_mode` 是既有本地偏好，不制造服务器导航 DTO 字段。该 focused 成功与更早独立实际身份/settings capture 分别保留，**focused回执不代替最终完整21；当前完整21另有实际成功回执**；生产/backend/API 未因本证据任务变更。

## 四项 Ruling 与继承限制

按执行时间排序，保留决策理由与代价：

1. **浏览器历史输入保留（Task 2）**：既有 BrowserRouter 不转换为 data router/不改历史内部实现。back/forward 允许导航，按真实 user/tenant/resource 隔离的会话内完整编辑副本、未提交提示、返回恢复及 beforeunload 防止静默丢失；保存/主动丢弃/身份改变清除。代价：结束浏览器会话不能恢复原始输入，副本不等于服务端 WIP，导航不是每次都被取消。
2. **UserInfo 故障不制造身份（Task 10）**：保留现有最佳努力 HTTP 200/SUCCESS、DTO、token 与签名/租户守卫；dashboard 与 IAM 一致缺 subject 时返回空 ID，不再 `u-{username}`。UI 拒绝缺 ID 个人会话。代价：依赖旧派生 ID 的消费者在 provider 故障时必须重试登录；有效 provider 身份兼容，不扩大角色权限。
3. **已加载自定义水位绑定不可编辑保存（Task 3）**：当前 save DTO 不提供 `ts_column`，repository upsert 会将省略值覆盖为 `updated_at`。检测实际加载的 custom watermark 后阻止保存、保留输入并解释限制；读取/物化/已保存配置同步和明确新建另一来源仍可用，普通/新来源可保存。代价：这些绑定的修改须等待已接受的保留配置 API，不能只提示后静默重置；本轮无后端水位新语义。
4. **CI-only 非特权源 fixture（Task 5）**：仅 ephemeral ontology-loop job 新建 `builder_source_fixture`，`NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`，显式本 job DB/schema 的 CONNECT/USAGE/CREATE；生成并 mask 密码，PG env 仅此 step；新增显式 `CI=true` loopback5432/metaplatform_ont/该角色 allowlist，实际 case 复核四标志。代价：新 CI setup 可能失败，须实际 CI 成功后才宣称通过；不改全局 init、生产角色、本地预览或存量数据。当前只有配置/源码验证，没有 CI 运行。

现有服务缺少 **saved-WIP revision 原子前置条件**。前端 exact reread、stored base、本地 generation 与当前共享同步命令所有权（覆盖 child apply/discard 和 parent branch/rollback/migration，跨 refresh/selection/read/身份变更保持至对应命令 settle）可阻止已观测陈旧结果与竞争写入，但不能排除 reread 与 apply 之间的并发服务端 WIP 替换。本轮未新增未接受的后端事务协议。另有 **RID grammar 不一致**：ClassRef/editor 接受的下划线 fixture 被现行 validation `_RID_RE` 判为 `valid:false`，UI 正确阻止 apply。通过 fixture 改用共同接受的 hyphen slug；该既有下划线边界没有修复，不能称所有合法编辑 RID 均可发布。

源列元数据/源样本预览、原型审批配置/沙箱或假执行若现行 API 不支持不开放；物化样本不是源样本。不变版本/current checksum 是模型事实；模型回滚不承诺实例恢复或外部副作用补偿。Neo4j legacy v1 未启动；embedder 为 hash、function backend 为 local subprocess，不外推远端模型/运行沙箱能力。

## 工具链、准备与复现

2026-10-09 当前源码安全版本/锁指纹见 [toolchain.json](evidence/2026-10-08-metaplatform-builder-v2/toolchain.json)：Python 3.12.13、Node 22.23.3（官方 SHA256 校验）、pnpm 11.15.1、uv 0.12.0；FastAPI 0.140.4、Starlette 1.3.1、uvicorn 0.51.0、httpx 0.28.1、psycopg 3.3.4、pytest 9.1.1。全局 Node 26 曾触发无关 jsdom localStorage 环境错误，当前 gates 用上述 Node22 first PATH。版本记录本身不是测试通过证据。

按根 AGENTS 在当前工作树执行 frozen `uv sync --python 3.12 --package mate-tech-ont --no-install-workspace`、导出 workspace dev group 并安装到本 .venv；前端 `pnpm install --frozen-lockfile --ignore-scripts`。后端 uv.lock、前端 pnpm-lock.yaml、contracts package-lock.json 为各工作区来源，根同名锁不替代。控制器实际 commandExecution 元数据确认 frozen backend sync、frontend frozen/ignore-scripts 各 completed/exit0；实际直接组合 shell 含 `pnpm rebuild puppeteer esbuild` 和 `pnpm exec playwright install chromium`，组合 shell completed/exit0、1716ms，不虚构每条独立 exit。准备不替代浏览器门禁。不要运行移除锁的 install:clean。

[独立本地验证入口](../../scripts/ci/run_builder_v2_validation.ps1) 与 [Python 实现](../../scripts/ci/run_builder_v2_validation.py) 消费 caller 的 private 环境输入，不读取/输出 compose 或私有配置，不 provision/restart/stop/free-port/reset/delete。它验证指定 PG 容器的 goal/project/loopback ownership、实际 PG16/角色与四非特权标志；拒绝默认共享 DB/服务地址。只生成 Git ignored 私有原始诊断和严格安全回执，source 前后指纹不一致或缺用例/失败/skip 则失败。原有 core/migration 配置通过运行区临时 overlay 移除 webServer 生命周期，保留原项目/文件/断言，不筛选必需 cases。

调用前自行在本地私密会话设置 `PG_DSN` 和相同 `VER_PG_DSN`（`127.0.0.1:55493/metaplatform_ont_test`、`mate_ont_test`）。浏览器同时需要显式 `E2E_BASE_URL=http://127.0.0.1:59260`、`E2E_GATEWAY_URL` 和 `E2E_GATEWAY=http://127.0.0.1:58110/api/v1`、`E2E_IAM_LOGIN_URL=http://127.0.0.1:58110/api/v1/iam/auth/login`，以及 `PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD` 指向本轮 `127.0.0.1:55493/codex_builder_ontology/builder_app`。不要将密码、DSN 值、JWT 或完整 environment 回显、写入报告或 Git。既有源码 helper 的公开演示登录 fixture 不代表生产账户；正式复现需本轮已配置的独立 provider。

```powershell
# 从仓库根目录；private 环境输入已在本地设置，不写在命令/文档中
$source = 'f892895200d57312fbb753866271d82f4d52af83'
./scripts/ci/run_builder_v2_validation.ps1 -Mode preflight -SourceCommit $source
./scripts/ci/run_builder_v2_validation.ps1 -Mode postgres -SourceCommit $source
$node = (Resolve-Path '.superpowers/runtime/node22/package/bin/node.exe').Path
$pnpm = Join-Path $env:APPDATA 'npm/node_modules/pnpm/bin/pnpm.cjs'
./scripts/ci/run_builder_v2_validation.ps1 -Mode core -SourceCommit $source -NodePath $node -PnpmPath $pnpm
./scripts/ci/run_builder_v2_validation.ps1 -Mode migration -SourceCommit $source -NodePath $node -PnpmPath $pnpm
./scripts/ci/run_builder_v2_validation.ps1 -Mode builder -SourceCommit $source -NodePath $node -PnpmPath $pnpm
```

入口的原始 PG 操作为 `mate-platform-backend/.venv/Scripts/python.exe scripts/ci/verify_ont_postgres.py --junit <new ignored run>/results.xml`，仍由原 gate 完整采集六组/逐条核对执行身份。原 migration 为 `pnpm exec playwright test --config playwright.migration.config.ts --list --reporter=./migration-list-reporter.ts` 和 `--workers=1`，安全清单/JUnit 分别交 `scripts/ci/verify_migration_browser.py --list/--junit`；Builder 对应 `playwright.builder.config.ts`、`builder-safe-reporter.ts` 与 `scripts/ci/verify_builder_browser.py --list <builder-list.json> --junit <builder.xml>`。控制器当前安全采集 9/2/21 皆 exit0、701 前后源码指纹一致，case 清单与最终执行分别登记；core/migration已通过公共guarded入口，Builder21通过控制器原runner。

**公共入口实际复现状态**：[preflight](evidence/2026-10-08-metaplatform-builder-v2/public-preflight.json) 已真实 exit0，owned PG16与四非特权标志通过；[core](evidence/2026-10-08-metaplatform-builder-v2/public-core.json) 实际9/9 exit0；[migration](evidence/2026-10-08-metaplatform-builder-v2/public-migration.json) 修复精确身份 parser 后实际2/2 exit0。旧 ownership guard失败另保留 [failed-01](evidence/2026-10-08-metaplatform-builder-v2/public-preflight-failed-01.json)。首次 migration原2/2通过却公共入口exit1，是Task6 parser遗漏 describe完整路径；[失败](evidence/2026-10-08-metaplatform-builder-v2/public-migration-failed-01.json) 与 [RED/GREEN](evidence/2026-10-08-metaplatform-builder-v2/parser-green.json) 分开保留。修复保留 file+完整suite/leaf精确比较、重复拒绝，同leaf不同suite/错误title边界已只读验证。公共 Builder和PG模式未实跑；原Builder21与原PG123各自归因。唯一accepted计划路径仅允许行首checkbox状态改变，归一化后全文须完全一致，其他plans/specs仍拒绝；[guard](evidence/2026-10-08-metaplatform-builder-v2/plan-guard.json) 实际计划只读边界验证通过，控制器已用当前 `e6117eb5...` 入口及checkbox更新后的计划实际执行正向preflight：exit0、owned PG16/四非特权标志通过；没有按e611重跑浏览器。实际public migration parser SHA为 `3a20a4a6...`，之后checkbox guard的当前entry SHA为 `e6117eb5...`，不追溯替换已执行hash，见 [复现source](evidence/2026-10-08-metaplatform-builder-v2/repro-source.json)。

前端原始 gates 从 `metaplatform-frontend` 用 Node22 first PATH 执行 `pnpm --filter @mate/web exec vitest run`、`pnpm --filter @mate/web typecheck`、`pnpm --filter @mate/web build`。contracts 从其独立目录执行锁定依赖工具 `npm run check` 及当前 contract pytest；完整原始输出只留忽略目录。

## 视觉取证与保留

52张只读最终图均为1440×1000、1920×1080、1024×900、390×844，严格一次真实login/UserInfo ID/签名tenant、每页settingsGET匹配与实际light主题，显式API/DOM named-ready；20Ont无HTTP替身，32平台使用相同boundary helper。全部52无pageerror/整页横溢出/写请求；平台503均对应已登记未启动域，KB/Gov显式unavailable。原Builder32图高度均1000，仅原ready/overflow断言，不制造逐帧身份/主题/error元数据，也不被新32替换。第一次平台取图失败后留下8图、无完整metadata，原因未确认；后续同逻辑补私有诊断而未放宽断言，完整32成功。

[逐页四尺寸像素观察](evidence/2026-10-08-metaplatform-builder-v2/visual-inspection.json) 覆盖全部52：窄屏graph Inspector已展开、mapping表/历史在fold下；type390长真实displayName及尾动作初视口裁切、query/explore390对象侧栏占视口但collapse按钮可见、gov390右pane局部裁切、chat390尾工具条初视口外。这些局部视图限制如实保留，未验证的交互可达性不写通过。

尺寸：1440×1000、1920×1080、1024×900、390×844。最终模型图必须真实模型/Inspector ready；类型页完成实际属性/关系/绑定读取；映射页实际类型与 binding/materialization settle；query 页实际结果 settle；release 页实际 WIP/versions 完成、publication/current-live 可见且 draft loader 隐藏。所有页面先核对成功匹配个人设置及应用主题；不能只等 networkidle。每张记录 source、页面/尺寸/ready 判据、真实/HTTP边界、pageerror/API failure 与 document overflow。最终像素检查另记交互，不能把无 document overflow 等同于所有局部控件可操作。

390px SuperAI 真实 native焦点已把 `.mp-chat-columns`（client286/scroll680）从scrollLeft0滚到213，末端“超能”控制在post-native settle后x227.47、trial可操作。最初几何采样时序和第二次CSS状态比较失败属于probe问题，不能计产品bug；随后第三/四次严格provider登录在UI前失败，第四次HTTP504后停止。语义radio checked变化/恢复与Team真实click/恢复仍未通过，type390“审阅与发布”尾部动作nativeTab/trial也未执行。详见 [未达交互](evidence/2026-10-08-metaplatform-builder-v2/narrow-interaction.json)，原失败JSON/PNG/XML/private日志保留，不用第三/四次provider失败替代行为RED。

本轮预览 [http://127.0.0.1:59260](http://127.0.0.1:59260) 保留。独立 ports：gateway58110、auth58111、Ont58017、PG55493、Keycloak55389、Redis55387；容器 `codex-242e-builder-v2-*`，goal `01a11b4d-ab28-7ed0-9a89-929e5fae1374`。不使用/重启其它工作树、共享服务或 DB，不释放端口。Docker host source-mount 曾 ENOMEM，仅本轮已确认拥有的 API 尝试停止；当前 native source，不能以旧 image 版本冒称当前源码。

Task 6 未完成，计划/SDD 运行目录和全部既有服务/数据/工作树继续保留。最终安全证据入 Git 后，控制器可将仍需的 helper/private runtime 显式镜像到 Git ignored `.superpowers/runtime/builder-v2`，逐个验证 absolute 源/目标路径和文件 allowlist、更新 helper 路径且不重启预览；**目前该镜像尚未执行**。compose/private config/raw log/auth-state/HAR/trace 不入公共证据；不删除现存工作树，不 reset/prune/remove/递归清理共享资源。一次 helper 源读取意外显示了源码公开演示 fixture 字面量，未读取/持久化 private-config、JWT 或私人环境值；后续只做内部字段 allowlist 提取。
