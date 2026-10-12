# Task 2 review — 02b42e8a840d3da320158eede66808c3f5bc979b..be62f0898157016e05d9313cc775c3d503a03a4f

## Spec Compliance

- ❌ Issues found：新建在关系目录读取失败/未完成时可能覆盖现有定义（I1），授权端点类型选择只覆盖前 100 条（I2）。
- brief 列出的 10 个文件都有对应变更；额外 4 文件是隔离 E2E helper/config，没有扩建身份系统。
- ⚠️ Task 1 完整并发/重放、真实 Keycloak 签名、正式 Gate/发布不属于本 diff 的独立验收。
- ⚠️ 全套前端仍是 71 passed / 1 failed，旧 Proposal fixture 归 Task 8；局部成功不能写为全套已绿（M4）。

## Strengths

- HTTP RID 前缀和 PG 显式 tenant_id WHERE 构成两层目录过滤，不依赖 owner/bypass-RLS，无 scope 保留旧目录语义：mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py:4606；mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/pg_repo.py:3060。同库双租户 HTTP、PG scoped/unscoped 测试：mate-platform-backend/packages/mate-tech-ont/tests/test_mp11_relationship_reads.py:49、:65。
- 定义复用 PropertyEditorV2/既有 DTO；编辑锁定标识/RID，实例存在或统计不可用时锁定端点、基数和方向，API 仍拒绝已有实例的结构更改：metaplatform-frontend/apps/web/src/pages/ontology/model/link-types/LinkTypeEditor.tsx:40、:55、:60；metaplatform-frontend/apps/web/src/pages/ontology/model/link-types/LinkTypesPage.tsx:59；mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py:4574。
- 关联使用实际对象 RID 和定义限定 classRid；保存 ref 防止同表单重复提交，操作 RID 保持稳定，失败保留端点/属性、成功重拉实例和统计：metaplatform-frontend/apps/web/src/pages/ontology/model/link-types/LinkInstanceEditor.tsx:15、:18、:47；metaplatform-frontend/apps/web/src/pages/ontology/model/link-types/LinkTypesPage.tsx:85。相同输入重试可复用 Task 1 幂等边界；本次未重复执行其并发测试。
- 实例、统计、端点读取失败有错误与重试，不把实例失败呈现为空：metaplatform-frontend/apps/web/src/pages/ontology/model/link-types/LinkTypesPage.tsx:23、:75、:87；metaplatform-frontend/apps/web/src/pages/ontology/model/link-types/LinkInstanceEditor.tsx:26、:54。
- 创建 props[property_rid]={value}、响应 props[property_rid]=value 与实际后端 DTO/转换一致，表格用 Object.entries：metaplatform-frontend/apps/web/src/api/ont/kernel.ts:119；metaplatform-frontend/apps/web/src/pages/ontology/model/link-types/LinkTypesPage.tsx:91；mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py:245、:254、:606。
- 对象详情 source/create 深链、预选以及继承/customer_id 的业务解释存在：metaplatform-frontend/apps/web/src/pages/ontology/OntologyModelingPage.tsx:882；metaplatform-frontend/apps/web/src/pages/ontology/model/link-types/LinkTypesPage.tsx:17、:58。
- Mock UI 明确标注 transport mocked；真实 E2E 同库播种邻居租户，覆盖创建、409 保留、reload、双端查询、只读拒绝与编辑持久化：metaplatform-frontend/apps/web/src/pages/ontology/model/link-types/LinkTypesPage.test.tsx:26、:70；metaplatform-frontend/apps/web/tests/e2e/ontology-relationship-flow.spec.ts:10、:49、:60、:69。
- Helper 校验 loopback 专用 PG、随机 codex_mp11_ui_ 库与专用端口，finally 只结束自己的进程树、删除匹配随机库；密钥在 runner/子进程环境，trace/video/screenshots 关闭：metaplatform-frontend/apps/web/tests/e2e/helpers/run-mp11-relationship.ps1:7、:10、:17、:53；metaplatform-frontend/apps/web/tests/e2e/helpers/mp11-relationship-api.py:14、:65；metaplatform-frontend/apps/web/tests/e2e/mp11-relationship.config.ts:6。未见真实凭据写入源码/报告；KeepHelpers 为显式保留，fixture 签名绕过不构成生产认证验证。

## Issues

### Critical (Must Fix)

无。

### Important (Should Fix)

#### I1 — 目录读取失败/未完成时，“新建”能静默覆盖已有定义

位置：metaplatform-frontend/apps/web/src/pages/ontology/model/link-types/LinkTypesPage.tsx:19、:27、:39；metaplatform-frontend/apps/web/src/pages/ontology/model/link-types/LinkTypeEditor.tsx:43、:47。

existingRids 初值 []，仅 listLinkTypes 成功更新；新建入口和保存不依赖目录成功。编辑器的 loading 只覆盖 object-types/value-types。GET link-types 503 或较慢、其他读取成功时，以已有 RID 提交“新建”，本地 includes 放行；POST 实际是 upsert，会保存已有定义：mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py:4571、:4590。

复现：已有 customer_orders；让关系目录读取 503；新建同标识、同 src/dst/cardinality/directionality。即使已有实例，名称/说明/关系属性仍会被新表单覆盖并报告成功，结构保护不能保护这些字段。另一个会话在目录加载后创建同名，也有相同 stale-catalog 风险。

修复：区分“未知”和“已确认不存在”，目录未成功读取时阻止新建保存并提供重试；新建提交需权威重复冲突判断，不能只依赖挂载快照。可保留既有默认 upsert 兼容语义，为新建路径增加明确冲突保护。验证目录失败及读取后并发同名时旧定义保持不变。

#### I2 — 端点类型选择静默截断到默认前 100 条

位置：metaplatform-frontend/apps/web/src/pages/ontology/model/link-types/LinkTypeEditor.tsx:32、:61、:64。

表单只调用一次 listObjectTypes()，无分页/搜索/续页，wrapper 也不传分页：metaplatform-frontend/apps/web/src/api/ont/kernel.ts:102。真实 HTTP 默认 limit=100, offset=0：mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py:1891。租户第 101 个及之后的已授权类型无法在新建关系中选择，界面没有提示，阻断这些类型的关系建模。两类型 fixture 检不出该问题。

修复：基于既有授权接口完整翻页或提供搜索/加载更多，并保持深链 source 的可见选中状态；验证超过 100 个类型且目标在后页。

### Minor (Nice to Have)

#### M1 — 实例端点“加载更多”参数未被真实 API 消费

位置：metaplatform-frontend/apps/web/src/pages/ontology/model/link-types/LinkInstanceEditor.tsx:20、:25、:59、:63。

GET individuals 仅声明 class_rid/markings，没有接收或下传 limit/offset：mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py:2748、:2760。恰好 200 条时“加载更多”永久重复同一批并去重；超过 200 条则一次渲染全部。现有对象仍可选，因此定为 Minor。应与实际契约一致：全量读取就去掉无效续页，或实现真实分页；覆盖 200/201 边界。

#### M2 — 失败页会连上一页按钮一起锁住

位置：metaplatform-frontend/apps/web/src/pages/ontology/model/link-types/LinkTypesPage.tsx:73、:75、:96。

请求开始 setRows(null)，失败只 setError；第 2 页后失败时 rows 仍 null，上一页禁用，只能重试该页或关闭重开。应区分 loading/failed，让失败时可返回上页。存在错误提示和恢复入口，本项为 Minor。

#### M3 — 继承的测试/构建警告仍在

位置：.superpowers/sdd/2026-10-11-metaplatform-product-v1.1-implementation/task-2-reads-final.log:4、:9、:13。

已查看读取日志为 3 passed / 3 warnings，包含 Starlette/httpx deprecation 和既有 11-byte HMAC fixture；报告另记录大 chunk 构建警告，未为重生成输出而重跑构建。这些不视为 Task 2 新生产故障；后续依赖/fixture/性能任务处理，不能宣称 warning-free。

#### M4 — 全套仍有独立复现的基线失败

位置：.superpowers/sdd/2026-10-11-metaplatform-product-v1.1-implementation/task-2-full-unit.log:290、:295；.superpowers/sdd/2026-10-11-metaplatform-product-v1.1-implementation/task-2-base02b-unit.log:277、:289。

当前 71 passed / 1 failed，基线快照 2 passed / 1 failed，均为 ProposalConfirmDrawer executeProposal 断言。遵循已明确 Task 8 归属，不归因 Task 2、不等同全套成功；Task 8 修正 fixture 并完成全套回归后再关闭。

## Focused checks and boundaries

- 固定 diff 只读取一次，未运行 Git。输出层截断中间 7,427 tokens，LinkTypeEditor、LinkTypesPage.test、LinkTypesPage hunk 不完整；按 hunk 中断例外补读这三个当前文件，未重读整个 diff。
- 默认 exec 两次报 helper_unknown_error/setup refresh；窄范围 require_escalated 读取成功。这是环境 helper 故障，不是自动审批拒绝。
- I1：额外读取共享 KernelPrimitiveListPage 的读取/操作启用状态和原有 upsert 函数，核对新建实际更新的路径。
- I2/M1：额外读取 listObjectTypes wrapper、HTTP object-types/individuals 参数/调用片段。两个 HTTP 均显式传当前 tenant_id，未扩大复审身份系统。
- DTO/重试契约：读取现有 LinkInstanceDTO/Response、响应转换和 create_link_instance API 片段，核对 props 与端点 tenant/class 检查。Task 1 repository 完整幂等/并发代码未重复审查。
- 读取既有 final reads/full unit/exact-base unit 日志匹配行，没有运行任何测试或构建。UI 6、writes 31、真实 E2E 1、typecheck/build 通过是既有报告证据；本审查评价实际测试代码覆盖，不冒充新的执行结果。
- 没有修改源码、索引、HEAD、分支或 Goal；仅新增本报告。I1/I2 由完整可见调用路径确定，无需重跑套件证明。

## Assessment

**Task quality: Needs fixes.**

租户过滤、真实 API/PG 链路、DTO 修正和失败保留做得扎实；先修 I1/I2，再 focused 验证对应场景。继承警告与 Task 8 基线失败保留边界，无须本任务重跑全套生成重复证据。
