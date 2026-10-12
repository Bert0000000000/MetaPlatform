# 1.1.0 local candidate completion audit

Complete local1.1.0 development candidate: all48 original plan acceptances/22 P0, task/full/scoped reviews, current code/signed business, preserved WIP and durable public/private archival/retirement verified. Not GA.

| Plan acceptance | Requirement | Evidence boundary |
|---|---|---|
| T1.1 | 在新测试中用真实 FastAPI router + InMemoryOntologyRepo 覆盖有效创建和负向写入，先运行失败用例；沿用既有测试身份 fixture，不关闭生产鉴权。 | Actual middleware/HTTP and PG locking, endpoint deletion, cardinality and description roundtrip; fixture identity is distinct from Task8 real issuer proof. |
| T1.2 | 补 API 层关系类型两端同租户、存在性和枚举错误归一化；实例写入验证关系类型存在、两端存在且类型正确，保留服务端写权限。HTTP 通过 create_link_instance(li, require_endpoints=True) 在 PG 事务内重验，并通过排序后的 FOR SHARE 与删除前 FOR UPDATE 保证端点生命周期；默认 False 仅保留已有直接 repo 调用兼容。 | Actual middleware/HTTP and PG locking, endpoint deletion, cardinality and description roundtrip; fixture identity is distinct from Task8 real issuer proof. |
| T1.3 | 关系已有实例时，阻止直接修改 src/dst/cardinality/directionality，允许名称与说明更新；不静默破坏已有实例。 | Actual middleware/HTTP and PG locking, endpoint deletion, cardinality and description roundtrip; fixture identity is distinct from Task8 real issuer proof. |
| T1.4 | 修复 PG upsert 更新分支未保存 description 的缺口；新增真实 PG 回归用例，DSN 只指向独立测试库，覆盖保存→更新→重新读取。 | Actual middleware/HTTP and PG locking, endpoint deletion, cardinality and description roundtrip; fixture identity is distinct from Task8 real issuer proof. |
| T1.5 | 运行新套件和邻近关系测试，保存命令/结果与 RED→GREEN 证据；审查后提交本任务文件。 | Actual middleware/HTTP and PG locking, endpoint deletion, cardinality and description roundtrip; fixture identity is distinct from Task8 real issuer proof. |
| T2.1 | 用 Vitest/Testing Library 编写行为测试：新建表单→选择 Customer/Order→保存；关联 C001/O001→刷新可见；服务端 409 保留输入；请求失败显示错误而非空列表。 | Mock UI errors/form retention plus real signed API/PG browser relations, 104 types/201 individuals/201 links, same-database tenant read guards. |
| T2.2 | 提供名称/标识、源/目标对象类型、基数、方向、两端名称、说明与关系属性；标识由业务名生成可编辑默认值，技术 RID 放高级区域；已有实例的结构字段说明受保护。 | Mock UI errors/form retention plus real signed API/PG browser relations, 104 types/201 individuals/201 links, same-database tenant read guards. |
| T2.3 | 严格区分新建和编辑：目录读取未知/失败时有提示与重试，权威创建保护拒绝读取后其他会话抢占的同 RID；旧定义保持不变。类型选项覆盖所有已授权页，后页类型和深链预选均可用；实例选择与真实接口的分页能力一致，失败页可返回上页。 | Mock UI errors/form retention plus real signed API/PG browser relations, 104 types/201 individuals/201 links, same-database tenant read guards. |
| T2.4 | 实例抽屉增加“关联对象”，按关系定义限制端点类型，选择实际对象及关系属性；保存期间防重复；成功重拉列表与统计，失败保留表单与重试。 | Mock UI errors/form retention plus real signed API/PG browser relations, 104 types/201 individuals/201 links, same-database tenant read guards. |
| T2.5 | 对象详情的“关系定义”增加指向关系页并预选当前对象的入口；显示继承与业务关系的区别，不将普通 customer_id 属性当作关联。 | Mock UI errors/form retention plus real signed API/PG browser relations, 104 types/201 individuals/201 links, same-database tenant read guards. |
| T2.6 | 同一独立数据库放入两租户关系，HTTP/PG 列表仅返回当前租户；PG 在请求租户上下文中显式过滤，HTTP 响应守住租户边界，不依赖建库角色的 RLS 行为。无上下文的旧直接 repo 调用保持兼容；不扩建身份系统。 | Mock UI errors/form retention plus real signed API/PG browser relations, 104 types/201 individuals/201 links, same-database tenant read guards. |
| T2.7 | 提供真实 API + 独立 PostgreSQL 的 E2E：创建定义/实例、负向基数、重载、两侧查询；UI Mock 测试单独标注。运行类型检查和构建，审查后提交。 | Mock UI errors/form retention plus real signed API/PG browser relations, 104 types/201 individuals/201 links, same-database tenant read guards. |
| T3.1 | 写入口测试：未登录可打开官网，CTA 到 /home 后进入现有登录；正式 build 产物含官网。 | Canonical dev and actual build22/22, configured/no-JS static entries, public screenshots and full product revision; signed anonymous/login/logout/relogin chain in Task8. |
| T3.2 | 沿用现有静态资源和品牌，展示真实能力、订单场景、数据→本体→应用→Agent 关系图；尚未通过验收的能力标“1.1 规划/验证中”。清除虚构链接、邮箱、不可打开的本地文档链接和历史测试数承诺。 | Canonical dev and actual build22/22, configured/no-JS static entries, public screenshots and full product revision; signed anonymous/login/logout/relogin chain in Task8. |
| T3.3 | 开发、构建、生产静态服务使用 frontend public/website/index.html 这一官网内容源；原 metaplatform-website/index.html 作为兼容入口并说明实际部署来源。容器构建上下文为 metaplatform-frontend，不依赖外层宿主文件；既有 dist COPY 已覆盖官网时不做无意义 Dockerfile 修改。平台认证与 API 配置不变。 | Canonical dev and actual build22/22, configured/no-JS static entries, public screenshots and full product revision; signed anonymous/login/logout/relogin chain in Task8. |
| T3.4 | Playwright 验证 360/390/768/1440 宽度、键盘、减少动态效果、导航/按钮和无横向溢出；同源默认入口及独立部署配置后的入口在禁用 JS 时均可用；保存仅公开官网的截图与无凭据请求结果。审查后提交。 | Canonical dev and actual build22/22, configured/no-JS static entries, public screenshots and full product revision; signed anonymous/login/logout/relogin chain in Task8. |
| T3.5 | 按 2026-10-11 用户要求重新设计平台定位与介绍，采用业务价值优先的“本体驱动的企业 AI 操作平台”叙事；清楚覆盖面向人群、业务问题、平台概览、能力与场景。 | Canonical dev and actual build22/22, configured/no-JS static entries, public screenshots and full product revision; signed anonymous/login/logout/relogin chain in Task8. |
| T3.6 | 增加独立的产品更新和版本规划入口：更新来自真实已完成开发增量，1.1.0/1.1.1/1.2 的当前阶段与未来目标分明；不使用虚构发布史或内部测试统计代替产品介绍。 | Canonical dev and actual build22/22, configured/no-JS static entries, public screenshots and full product revision; signed anonymous/login/logout/relogin chain in Task8. |
| T3.7 | 复用上述三项官网文件与入口/URL 配置约束，保留旧锚点；检查最终开发/构建产物、移动/键盘/无 JS 以及桌面和移动视觉效果，经独立审查后恢复 Task 6。 | Canonical dev and actual build22/22, configured/no-JS static entries, public screenshots and full product revision; signed anonymous/login/logout/relogin chain in Task8. |
| T4.1 | 编写同 RID 重复新增与并发新增不覆盖、正常编辑仍可更新的回归；新建返回 409 时表单保留并可定位已有类型。 | Atomic create-only/WIP intent, checksum/publish/rollback locks, native navigation, actual discovered fields, same-family migrated relation endpoints; actual app/action impact in Task8. |
| T4.2 | 将入口文案统一为“新建对象类型”；基础/高级字段渐进显示，名称/主键/属性问题就地提示。 | Atomic create-only/WIP intent, checksum/publish/rollback locks, native navigation, actual discovered fields, same-family migrated relation endpoints; actual app/action impact in Task8. |
| T4.3 | 修复相似候选后的继续创建、合并和取消路径；未保存源概念不能调用要求源对象存在的 merge，改为复用已有类型或回到表单。 | Atomic create-only/WIP intent, checksum/publish/rollback locks, native navigation, actual discovered fields, same-family migrated relation endpoints; actual app/action impact in Task8. |
| T4.4 | 对象类型写入口使用既有 platform.write 拒绝只读修改；同租户 ActionType.on 精确引用进入预检。应用反向引用由任务 6 的真实 AppHub 绑定契约补齐，并接入同一影响面板；完整 ONT-03 以任务 8 的已发布应用场景验收。 | Atomic create-only/WIP intent, checksum/publish/rollback locks, native navigation, actual discovered fields, same-family migrated relation endpoints; actual app/action impact in Task8. |
| T4.5 | 打通保存草稿、恢复、未保存离开提示、预检与发布；变更影响沿用既有机制，验证乐观并发冲突提示。 | Atomic create-only/WIP intent, checksum/publish/rollback locks, native navigation, actual discovered fields, same-family migrated relation endpoints; actual app/action impact in Task8. |
| T4.6 | 测试重复 slug/RID、候选 API 不可用、错误恢复、刷新草稿、发布后真实对象查询；复核同族版本发布/存量实例迁移后已有关系和新关联的类型引用，先确认既有实现再修复断点，避免重建 PR #95。审查后提交。 | Atomic create-only/WIP intent, checksum/publish/rollback locks, native navigation, actual discovered fields, same-family migrated relation endpoints; actual app/action impact in Task8. |
| T5.1 | 用独立 PG 编写错密码/无 schema 权限/不存在表与正常发现的失败回归；错误不得返回 connected=true 或虚构字段。 | Actual SQL/CSV adapters, credential whitelist and denied probes, discovered column prechecks, time+key cursor, failed/interrupted runs and retries; source deletes do not delete objects; CSV batch/upsert is not CDC. |
| T5.2 | 将 /test 与 /schema 接线从 stub 移到真实适配器；数据库凭据仅服务端使用，样例按权限掩码。 | Actual SQL/CSV adapters, credential whitelist and denied probes, discovered column prechecks, time+key cursor, failed/interrupted runs and retries; source deletes do not delete objects; CSV batch/upsert is not CDC. |
| T5.3 | 补齐时间列与增量参数传递/持久化，使用真实列映射 Customer/Order，同步前显示主键、非空、类型冲突；CSV 上传路径明确为批量导入。 | Actual SQL/CSV adapters, credential whitelist and denied probes, discovered column prechecks, time+key cursor, failed/interrupted runs and retries; source deletes do not delete objects; CSV batch/upsert is not CDC. |
| T5.4 | 同步显示真实运行 ID、计数、游标和错误；取消/失败结束 loading，重试不重复生成订单，删除与全量重建行为明确。 | Actual SQL/CSV adapters, credential whitelist and denied probes, discovered column prechecks, time+key cursor, failed/interrupted runs and retries; source deletes do not delete objects; CSV batch/upsert is not CDC. |
| T5.5 | 数据与治理域提供可见的 /gov/data/sources 数据源配置入口，并连到既有本体映射；不能只更新未挂载的 AssetsInventoryPage。修正实际 source CRUD 请求/响应与 schema 类型，移除探测失败时随机成功和虚构表字段；真实发现结果带 discovered_at/trace_id，表/列列表契约保持兼容。 | Actual SQL/CSV adapters, credential whitelist and denied probes, discovered column prechecks, time+key cursor, failed/interrupted runs and retries; source deletes do not delete objects; CSV batch/upsert is not CDC. |
| T5.6 | 验证首次全量→增量→中断/重试→进程重启→对象及关系查询。审查后提交。 | Actual SQL/CSV adapters, credential whitelist and denied probes, discovered column prechecks, time+key cursor, failed/interrupted runs and retries; source deletes do not delete objects; CSV batch/upsert is not CDC. |
| T6.1 | 编写应用状态和空运行树失败回归；未发布应用不能显示已发布，错误运行树不能自动落到演示数据。 | Actual SQL metadata/revision CAS/create concurrency and published snapshot binding/history, denied empty trees/dependencies, real human execution and receipt; Task6 fixture identity is superseded by distinct Task8 signed evidence. |
| T6.2 | 修正卡片和详情的真实元数据，明确运行/编辑/发布入口；保护未保存变更。 | Actual SQL metadata/revision CAS/create concurrency and published snapshot binding/history, denied empty trees/dependencies, real human execution and receipt; Task6 fixture identity is superseded by distinct Task8 signed evidence. |
| T6.3 | 首页提供“从样例开始 / 接入真实数据 / 打开已有应用”和可恢复任务引导（UX-01）；选择与当前位置按用户/租户隔离保存，完成状态来自实际数据、类型、关系、应用与发布输出，不能用手工勾选或 seed 伪装完成；错误状态可重试。 | Actual SQL metadata/revision CAS/create concurrency and published snapshot binding/history, denied empty trees/dependencies, real human execution and receipt; Task6 fixture identity is superseded by distinct Task8 signed evidence. |
| T6.4 | 用已有模板与组件生成订单审核应用，绑定已发布 Order/ObjectSet、真实字段、Customer 关联和已注册审核 Action。 | Actual SQL metadata/revision CAS/create concurrency and published snapshot binding/history, denied empty trees/dependencies, real human execution and receipt; Task6 fixture identity is superseded by distinct Task8 signed evidence. |
| T6.5 | 基于真实 AppHub 对象/动作绑定提供同租户反向引用清单，接入本体发布影响预览（ONT-03）；动作引用复用 ActionType.on，应用引用显示实际应用 ID/名称/绑定版本/发布状态。接口失败显示未知，禁止把未查询或模糊 RID 字符串扫描当作无引用；任务 8 验证已发布订单应用的模型变更影响。 | Actual SQL metadata/revision CAS/create concurrency and published snapshot binding/history, denied empty trees/dependencies, real human execution and receipt; Task6 fixture identity is superseded by distinct Task8 signed evidence. |
| T6.6 | 发布前核验缺失对象/字段/权限/动作依赖，预览使用实际绑定；发布版本与运行入口一致。 | Actual SQL metadata/revision CAS/create concurrency and published snapshot binding/history, denied empty trees/dependencies, real human execution and receipt; Task6 fixture identity is superseded by distinct Task8 signed evidence. |
| T6.7 | 验证发布→短链→读取订单→人工确认→执行回执→重新登录仍可追踪；无权/无效短链有明确错误。审查后提交。 | Actual SQL metadata/revision CAS/create concurrency and published snapshot binding/history, denied empty trees/dependencies, real human execution and receipt; Task6 fixture identity is superseded by distinct Task8 signed evidence. |
| T7.1 | 编写配置导出无凭据、只读工具过滤、未授权调用拒绝、跨租户和过期确认的回归。 | Actual operation mapping, persisted delegated grant scopes/revocation, caller/tenant/human/deadline restrictions, protocol discovery and same-object query; native clients remain1.1.1. |
| T7.2 | 提供工作区/权限选择、配置、发现测试、样例查询；仅实际 initialize/tools-list/query 成功后显示已连接。 | Actual operation mapping, persisted delegated grant scopes/revocation, caller/tenant/human/deadline restrictions, protocol discovery and same-object query; native clients remain1.1.1. |
| T7.3 | 对已有工具暴露/调用者/批准者规则做最小修复；不增加提示词式的“权限控制”，不另建身份系统。 | Actual operation mapping, persisted delegated grant scopes/revocation, caller/tenant/human/deadline restrictions, protocol discovery and same-object query; native clients remain1.1.1. |
| T7.4 | 记录协议测试与真客户端测试分别结果；dsh / WorkBuddy 真客户端验证在 1.1.1 范围，1.1.0 提供可验证协议/配置准备结果及明确边界。 | Actual operation mapping, persisted delegated grant scopes/revocation, caller/tenant/human/deadline restrictions, protocol discovery and same-object query; native clients remain1.1.1. |
| T7.5 | 审查后提交。 | Actual operation mapping, persisted delegated grant scopes/revocation, caller/tenant/human/deadline restrictions, protocol discovery and same-object query; native clients remain1.1.1. |
| T8.1 | 集成新关系、对象创建、数据、应用、官网和 Agent 契约检查，并覆盖现有 ontology-migration-plan.spec.ts。 | Full suites plus named covering amendments and two distinct default Browser44/44; actual fresh/0020 upgrade, normal Keycloak/Redis/PG, guarded faults/polling+explicit restart, receipt replay and compensation. Whole-branch and scoped source gates passed; private cleanup exit separately recorded. |
| T8.2 | 新库与升级库运行 Customer/Order 样例；重启、同幂等键重放、基数冲突、错列和断连恢复；健康探针辅以实际业务查询。 | Full suites plus named covering amendments and two distinct default Browser44/44; actual fresh/0020 upgrade, normal Keycloak/Redis/PG, guarded faults/polling+explicit restart, receipt replay and compensation. Whole-branch and scoped source gates passed; private cleanup exit separately recorded. |
| T8.3 | 运行前端类型检查/构建、受影响单元和实际 API/PG 集成/E2E；必要故障只注入独立环境。 | Full suites plus named covering amendments and two distinct default Browser44/44; actual fresh/0020 upgrade, normal Keycloak/Redis/PG, guarded faults/polling+explicit restart, receipt replay and compensation. Whole-branch and scoped source gates passed; private cleanup exit separately recorded. |
| T8.4 | 独立任务审查以及全部任务后的整体审查，修复阻断项；保留用户原 WIP。 | Full suites plus named covering amendments and two distinct default Browser44/44; actual fresh/0020 upgrade, normal Keycloak/Redis/PG, guarded faults/polling+explicit restart, receipt replay and compensation. Whole-branch and scoped source gates passed; private cleanup exit separately recorded. |
| T8.5 | 输出候选版说明与可启动预览、部署配置、回滚/补偿说明。目标完成仅指本计划 1.1.0 开发候选版通过；正式部署、72 小时 SLO、用户试用及 1.1.1/1.2 项独立列明，不冒称 GA。 | Full suites plus named covering amendments and two distinct default Browser44/44; actual fresh/0020 upgrade, normal Keycloak/Redis/PG, guarded faults/polling+explicit restart, receipt replay and compensation. Whole-branch and scoped source gates passed; private cleanup exit separately recorded. |

| P0 requirement | Verified plan acceptance |
|---|---|
| MP11-WEB-01 | T3.1, T3.2, T3.3, T3.5, T3.6, T6.7 |
| MP11-WEB-02 | T3.4, T3.7 |
| MP11-UX-01 | T6.3 |
| MP11-DATA-01 | T5.1, T5.2, T5.5 |
| MP11-DATA-02 | T5.3, T4.6 |
| MP11-DATA-03 | T5.3, T5.6 |
| MP11-DATA-04 | T5.4, T5.6 |
| MP11-ONT-01 | T4.2, T4.6, T5.3 |
| MP11-ONT-02 | T4.5, T4.6 |
| MP11-ONT-03 | T4.4, T4.5, T6.5 |
| MP11-ONT-06 | T1.2, T1.3, T1.4, T2.2, T2.3, T2.5 |
| MP11-ONT-07 | T1.2, T2.4, T2.6, T2.7 |
| MP11-ONT-08 | T4.1, T4.3, T4.5, T4.6 |
| MP11-APP-01 | T6.1, T6.2 |
| MP11-APP-02 | T6.2, T6.7, T8.2 |
| MP11-APP-03 | T6.4, T6.6, T6.7 |
| MP11-APP-04 | T6.1, T6.6, T6.7 |
| MP11-AGENT-01 | T7.1, T7.2, T7.4 |
| MP11-AGENT-02 | T7.1, T7.3, T8.2 |
| MP11-REL-01 | T2.3, T4.5, T5.4, T6.6, T7.2 |
| MP11-REL-02 | T8.2, T8.3 |
| MP11-REL-03 | T8.2, T8.3 |

Exact current fingerprints, all88 named-file applicability entries and the two justified unchanged files are in completion-audit-matrix.json. Remote deployment,72-hourSLO, user study and native dsh/WorkBuddy remain release/follow-on boundaries.
