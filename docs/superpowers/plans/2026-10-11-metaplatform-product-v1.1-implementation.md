# MetaPlatform 产品 1.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox syntax for tracking. 用户于 2026-10-11 已明确授权：整理版本规划后使用目标模式执行；不再逐任务申请开发确认。

**Goal:** 交付产品 1.1.0 开发候选版：官网进入平台，业务人员创建对象类型与关系、接入真实数据、生成并运行订单审核应用，Agent 在授权范围内查询和提出操作建议；每个出口有可复核的验收证据。

**Architecture:** 延续当前 FastAPI / React / Semi UI / AppHub / Ontology Kernel / MCP 结构。关系类型和关系实例复用既有写接口，补齐端点约束和用户操作；数据 API 接真实连接器；应用发布使用既有运行入口。复用 metaplatform-website，通过同源 /website/ → /home 进入现有认证流程。

**Tech Stack:** Python 3.12+、FastAPI、PostgreSQL、React 19、TypeScript 5.7、Semi UI、Vite 6、Vitest、Playwright；不新增完整低代码、身份或图数据库平台。

**Spec:** docs/active/specs/2026-10-11-metaplatform-product-v1.1.md
**Research:** docs/active/research/2026-10-11-ontology-platform-survey.md
**Baseline:** 2c13952c / feat/ont-migration-plan；执行分支 codex/product-v1.1。

## Global Constraints

- 当前用户指定仓库为 D:/Hermes/Workspace/10_Projects/2026-07-02-MetaPlatform；保留截图、工作树和其他在途修改，仅暂存本计划拥有的文件。
- 产品 1.1 不改写 v3.x 架构版本、已 Accepted 的 PRD/ADR、Gate 或历史验收状态。
- 保留现有数据库、Keycloak、9200 预览和运行容器；验证使用 codex-mp11- 前缀的独立服务、独立端口及一次性数据库，不连接生产库跑写测试。
- 官网公开，业务入口 /home 由既有认证处理；凭据不进入官网、配置导出、报告或截图。
- 未实现和不可用必须可辨认；失败不得转换为 0 条、已连接、已发布或演示成功。
- 写操作保持租户、权限、类型、基数和幂等边界；新建与更新语义要明确，关系定义不会自动生成业务关系实例。
- 使用既有 OpenAPI / operationId / DTO；不直接复制 NocoBase、Directus 或未核验许可的源码。
- 测试以用户可观察行为和完整业务链为准；Mock UI 测试、真实 API/数据库验收、正式发布分别记录。

## 版本范围与交付顺序

| 版本/阶段 | 用户可获得的结果 | 需求覆盖 | 出口 |
|---|---|---|---|
| 1.1.0 M1 本体可操作 | 创建客户/订单，定义一对多关系，关联具体实例并查询 | ONT-06/07/08、ONT-01..03 的操作一致性、REL-01 | 前端不依赖手工调用 API；非法关联明确拒绝；重载可查 |
| 1.1.0 M2 数据可信 | PostgreSQL/CSV 接入、真实连接诊断、映射、增量参数、同步恢复 | DATA-01..04、ONT-01..03、REL-01/02 | 实际字段进入本体；错误参数、重试、重启行为可证 |
| 1.1.0 M3 应用可运行 | 真实应用元数据、对象绑定、模板创建、预览、发布与运行 | APP-01..05、UX-01 | 订单审核应用读取 M2 数据；确认操作有执行回执 |
| 1.1.0 M4 官网与 Agent 入口 | 官网直达登录；客户端配置、探测、只读范围与提案约束 | WEB-01..03、AGENT-01/02 | 官网桌面/移动可用；未授权工具不可见/不可调用；配置不泄密 |
| 1.1.0 M5 候选版验收 | 新库/升级库、重启、重复请求和故障恢复；发布包及边界 | REL-02/03、上述全部 P0 | 完整订单链实际通过；回归与升级证据齐全 |
| 1.1.1 兼容与体验增强 | dsh / WorkBuddy 真客户端联调、插件诊断、资产契约、图谱操作优化 | AGENT-03/04、PLUGIN-01、DATA-05/06、ONT-04、REL-04 | 记录客户端版本与协议结果，撤销/重连可验证 |
| 1.2 标准互操作 | 固定 OWL/RDF/SHACL 支持子集与映射验证，按容量证据扩展 | ONT-05 | 标准转换的丢失项和回导行为明确 |

先实现首条可用链路，再扩展数据类型与模板。五人/6–8 周只作为原草案容量参考；目标模式按出口推进，不以天数或提交数量判定交付。5 人首次使用测量、72 小时试运行 SLO、正式域名/HTTPS 部署是发布验证项，不能用开发测试替代。

## 统一验收样例

- 类型 Customer / Order，属性 id、name / id、customer_id、amount、status。
- 关系 customer_orders：Customer → Order，1:N；客户侧名称“订单”、订单侧名称“客户”。
- 实例 C001 / O001、O002；C001 可关联两个订单，第二个客户不能占用同一订单。
- 数据来自独立测试 PostgreSQL 和固定 CSV；订单审核应用查询同一对象集合。
- 通过人工确认的动作将订单状态变为 approved，记录 proposal、执行回执、幂等键与审计。
- 重复请求最多一次副作用；错误租户、错误端点类型、缺失对象、无权身份、错列、断连分别有明确结果。

## Task 1: 关系写接口校验与持久化一致性

**Files:**
- Modify: mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py
- Modify: mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/pg_repo.py
- Modify: mate-platform-backend/packages/mate-kernel/src/mate_kernel/ontology/api.py（可选 strict 写参数，默认兼容）
- Modify: mate-platform-backend/packages/mate-kernel/src/mate_kernel/ontology/in_memory.py（对应 strict 验证）
- Create: mate-platform-backend/packages/mate-tech-ont/tests/test_mp11_relationship_writes.py
- Test: mate-platform-backend/packages/mate-kernel/tests/test_ontology_api.py
- Contract: mate-platform-backend/contracts/openapi/services/ont.yaml（仅在实际契约变化时更新）

**Interfaces:** 维持 POST /api/v1/ont/v2/link-types 的 LinkTypeDTO（rid/src/dst/cardinality/directionality/link_properties/src_display_name/dst_display_name/description）；维持 POST /link-instances 的 LinkInstanceDTO（rid/link_type_rid/src/dst/props/marking）。输出 DTO 不变，非法枚举与不匹配 422、缺失资源 404、跨租户 403、基数/已有实例阻止定义变更 409；错误 detail 保持可读。

- [ ] 在新测试中用真实 FastAPI router + InMemoryOntologyRepo 覆盖有效创建和负向写入，先运行失败用例；沿用既有测试身份 fixture，不关闭生产鉴权。
```python
assert response.status_code == 403  # src 或 dst 指向其他租户
assert response.status_code == 404  # 关系类型/端点不存在
assert response.status_code == 422  # 实例 class_rid 与 LinkType.src/dst 不匹配
assert response.status_code == 409  # 1:N 的同一订单再次归属于另一客户
```
- [ ] 补 API 层关系类型两端同租户、存在性和枚举错误归一化；实例写入验证关系类型存在、两端存在且类型正确，保留服务端写权限。HTTP 通过 create_link_instance(li, require_endpoints=True) 在 PG 事务内重验，并通过排序后的 FOR SHARE 与删除前 FOR UPDATE 保证端点生命周期；默认 False 仅保留已有直接 repo 调用兼容。
- [ ] 关系已有实例时，阻止直接修改 src/dst/cardinality/directionality，允许名称与说明更新；不静默破坏已有实例。
- [ ] 修复 PG upsert 更新分支未保存 description 的缺口；新增真实 PG 回归用例，DSN 只指向独立测试库，覆盖保存→更新→重新读取。
- [ ] 运行新套件和邻近关系测试，保存命令/结果与 RED→GREEN 证据；审查后提交本任务文件。

## Task 2: 关系定义和实例关联界面

**Files:**
- Modify: metaplatform-frontend/apps/web/src/api/ont/kernel.ts
- Modify: metaplatform-frontend/apps/web/src/pages/ontology/model/link-types/LinkTypesPage.tsx
- Create: metaplatform-frontend/apps/web/src/pages/ontology/model/link-types/LinkTypeEditor.tsx
- Create: metaplatform-frontend/apps/web/src/pages/ontology/model/link-types/LinkInstanceEditor.tsx
- Create: metaplatform-frontend/apps/web/src/pages/ontology/model/link-types/LinkTypesPage.test.tsx
- Create: metaplatform-frontend/apps/web/tests/e2e/ontology-relationship-flow.spec.ts
- Modify: metaplatform-frontend/apps/web/src/pages/ontology/OntologyModelingPage.tsx

**Interfaces:** createLinkType(payload: KernelLinkType): Promise<KernelLinkType>；createLinkInstance(payload: KernelLinkInstanceCreate): Promise<KernelLinkInstance>，后者请求形状服从 Task 1。端点选项来自已授权 listObjectTypes / listIndividuals；关系编辑复用已有属性 DTO，不发明第二套模型。

- [ ] 用 Vitest/Testing Library 编写行为测试：新建表单→选择 Customer/Order→保存；关联 C001/O001→刷新可见；服务端 409 保留输入；请求失败显示错误而非空列表。
```tsx
expect(screen.getByRole('button', { name: '新建关系' })).toBeEnabled();
expect(await screen.findByText('订单已关联其他客户')).toBeVisible();
```
- [ ] 提供名称/标识、源/目标对象类型、基数、方向、两端名称、说明与关系属性；标识由业务名生成可编辑默认值，技术 RID 放高级区域；已有实例的结构字段说明受保护。
- [ ] 实例抽屉增加“关联对象”，按关系定义限制端点类型，选择实际对象及关系属性；保存期间防重复；成功重拉列表与统计，失败保留表单与重试。
- [ ] 对象详情的“关系定义”增加指向关系页并预选当前对象的入口；显示继承与业务关系的区别，不将普通 customer_id 属性当作关联。
- [ ] 提供真实 API + 独立 PostgreSQL 的 E2E：创建定义/实例、负向基数、重载、两侧查询；UI Mock 测试单独标注。运行类型检查和构建，审查后提交。

## Task 3: 官网进入平台

**Files:**
- Modify: metaplatform-website/index.html
- Create: metaplatform-frontend/apps/web/public/website/index.html（官网唯一内容源；迁入已有静态设计）
- Create: metaplatform-website/README.md（独立部署与兼容入口说明）
- Modify: metaplatform-frontend/apps/web/vite.config.ts
- Modify: metaplatform-frontend/Dockerfile
- Create: metaplatform-frontend/apps/web/tests/e2e/website-entry.spec.ts

**Interfaces:** 公开 /website/ 与 /website/index.html；所有“进入平台”默认同源 /home，AuthGuard 负责登录。独立静态部署支持一个明确平台 URL 配置；仅允许 http(s)/同源路径，拒绝 javascript/data 协议。

- [ ] 写入口测试：未登录可打开官网，CTA 到 /home 后进入现有登录；正式 build 产物含官网。
- [ ] 沿用现有静态资源和品牌，展示真实能力、订单场景、数据→本体→应用→Agent 关系图；尚未通过验收的能力标“1.1 规划/验证中”。清除虚构链接、邮箱、不可打开的本地文档链接和历史测试数承诺。
- [ ] 开发、构建、生产静态服务使用 frontend public/website/index.html 这一官网内容源；原 metaplatform-website/index.html 作为兼容入口并说明实际部署来源。容器构建上下文为 metaplatform-frontend，不依赖外层宿主文件；既有 dist COPY 已覆盖官网时不做无意义 Dockerfile 修改。平台认证与 API 配置不变。
- [ ] Playwright 验证 390/768/1440 宽度、键盘、导航/按钮和无横向溢出；保存截图与请求结果。审查后提交。

## Task 4: 对象创建与草稿操作一致性

**Files:**
- Modify: metaplatform-frontend/apps/web/src/pages/ontology/model/object-types/ObjectTypesPage.tsx
- Modify: metaplatform-frontend/apps/web/src/pages/ontology/components/ObjectTypeEditorV2Drawer.tsx
- Modify: metaplatform-frontend/apps/web/src/pages/ontology/OntologyModelingPage.tsx
- Modify: metaplatform-frontend/apps/web/src/api/ont/kernel.ts
- Modify: mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py
- Modify: mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/pg_repo.py
- Modify: mate-platform-backend/packages/mate-kernel/src/mate_kernel/ontology/in_memory.py
- Create: mate-platform-backend/packages/mate-tech-ont/tests/test_mp11_object_type_creation.py
- Create: metaplatform-frontend/apps/web/src/pages/ontology/components/ObjectTypeEditorV2Drawer.test.tsx

**Interfaces:** POST /object-types 可增加向后兼容的 create_only 查询参数；仅界面新建设置 true，已有更新/发布继续原语义；存在同 RID 时 409，禁止检查后覆盖竞态。草稿复用已存在 schema-wip / publish 接口，status 元数据与草稿存储明确区分。

- [ ] 编写同 RID 重复新增与并发新增不覆盖、正常编辑仍可更新的回归；新建返回 409 时表单保留并可定位已有类型。
- [ ] 将入口文案统一为“新建对象类型”；基础/高级字段渐进显示，名称/主键/属性问题就地提示。
- [ ] 修复相似候选后的继续创建、合并和取消路径；未保存源概念不能调用要求源对象存在的 merge，改为复用已有类型或回到表单。
- [ ] 打通保存草稿、恢复、未保存离开提示、预检与发布；变更影响沿用既有机制，验证乐观并发冲突提示。
- [ ] 测试重复 slug/RID、候选 API 不可用、错误恢复、刷新草稿、发布后真实对象查询；复核同族版本发布/存量实例迁移后已有关系和新关联的类型引用，先确认既有实现再修复断点，避免重建 PR #95。审查后提交。

## Task 5: 真实数据接入与同步恢复

**Files:**
- Modify: mate-platform-backend/packages/mate-tech-data/src/mate_tech_data/api/app.py
- Modify: mate-platform-backend/packages/mate-tech-data/src/mate_tech_data/repositories/in_memory.py
- Modify: mate-platform-backend/packages/mate-tech-data/src/mate_tech_data/repositories/sql_store.py
- Modify: metaplatform-frontend/apps/web/src/pages/ontology/data/mappings/BackingDatasourcePanel.tsx
- Create: mate-platform-backend/packages/mate-tech-data/tests/test_mp11_connection_schema.py
- Create: metaplatform-frontend/apps/web/src/pages/ontology/data/mappings/BackingDatasourcePanel.test.tsx
- Modify: metaplatform-frontend/apps/web/tests/e2e/ontology-ia-v2-data-flow.spec.ts

**Interfaces:** 数据源测试与 schema 读取调用实际 PostgreSQL/CSV 适配器，SQL/内存存储选择不影响探测真实性；backing datasource 的时间列、主键、字段映射进入已支持的后端请求 DTO。连接结果区分认证、权限、网络、schema 错误，保留 traceId 和重试操作。

- [ ] 用独立 PG 编写错密码/无 schema 权限/不存在表与正常发现的失败回归；错误不得返回 connected=true 或虚构字段。
- [ ] 将 /test 与 /schema 接线从 stub 移到真实适配器；数据库凭据仅服务端使用，样例按权限掩码。
- [ ] 补齐时间列与增量参数传递/持久化，使用真实列映射 Customer/Order，同步前显示主键、非空、类型冲突；CSV 上传路径明确为批量导入。
- [ ] 同步显示真实运行 ID、计数、游标和错误；取消/失败结束 loading，重试不重复生成订单，删除与全量重建行为明确。
- [ ] 验证首次全量→增量→中断/重试→进程重启→对象及关系查询。审查后提交。

## Task 6: 应用中心的对象绑定、发布和运行

**Files:**
- Modify: mate-platform-backend/packages/mate-app-hub/src/mate_app_hub/api/app.py
- Modify: mate-platform-backend/packages/mate-app-hub/src/mate_app_hub/repositories/sql_store.py
- Modify: metaplatform-frontend/apps/web/src/api/apphub/apps.ts
- Modify: metaplatform-frontend/apps/web/src/pages/apphub/AppListPage.tsx
- Modify: metaplatform-frontend/apps/web/src/pages/apphub/AppDetailPage.tsx
- Modify: metaplatform-frontend/apps/web/src/pages/apphub/PageDesignerPage.tsx
- Modify: metaplatform-frontend/apps/web/src/pages/apphub/components/FormBinding.tsx
- Modify: metaplatform-frontend/apps/web/src/pages/apphub/components/PublishValidation.tsx
- Modify: metaplatform-frontend/apps/web/src/pages/apphub/runtime/AppRuntimePage.tsx
- Create: metaplatform-frontend/apps/web/src/pages/apphub/AppListPage.test.tsx
- Create: metaplatform-frontend/apps/web/tests/e2e/mp11-order-app-flow.spec.ts

**Interfaces:** 以既有 AppHub DTO、版本/发布记录、/s/:code 和 ObjectSet/Action 绑定为权威；在实际后端 app 服务中补齐缺失的责任人/修改时间/发布状态字段，并同步 OpenAPI，禁止用 tags/version 拼造这些字段。

- [ ] 编写应用状态和空运行树失败回归；未发布应用不能显示已发布，错误运行树不能自动落到演示数据。
- [ ] 修正卡片和详情的真实元数据，明确运行/编辑/发布入口；保护未保存变更。
- [ ] 用已有模板与组件生成订单审核应用，绑定已发布 Order/ObjectSet、真实字段、Customer 关联和已注册审核 Action。
- [ ] 发布前核验缺失对象/字段/权限/动作依赖，预览使用实际绑定；发布版本与运行入口一致。
- [ ] 验证发布→短链→读取订单→人工确认→执行回执→重新登录仍可追踪；无权/无效短链有明确错误。审查后提交。

## Task 7: Agent 配置、连接探测和授权范围

**Files:**
- Modify: metaplatform-frontend/apps/web/src/pages/mcp/IdeConfigPage.tsx
- Modify: metaplatform-frontend/apps/web/src/pages/mcp/McpClientPage.tsx
- Modify: mate-platform-backend/packages/mate-tech-mcp/src/mate_tech_mcp/tools/ontology_proxy.py
- Create: metaplatform-frontend/apps/web/src/pages/mcp/IdeConfigPage.test.tsx
- Create: mate-platform-backend/packages/mate-tech-mcp/tests/test_mp11_client_contract.py
- Create: docs/active/delivery/evidence/MP11-AGENT-COMPATIBILITY.md

**Interfaces:** 复用 /api/v1/mcp/protocol/mcp 与既有 scoped/revocable API Key；dsh 使用已核实的 HTTP 配置格式，WorkBuddy 导出文档支持的 stdio 配置，未实现桥时不能标已连接。工具 schema 与现有 operationId 对齐；Agent 建议经 Proposal，批准由已认证有权限主体完成。

- [ ] 编写配置导出无凭据、只读工具过滤、未授权调用拒绝、跨租户和过期确认的回归。
- [ ] 提供工作区/权限选择、配置、发现测试、样例查询；仅实际 initialize/tools-list/query 成功后显示已连接。
- [ ] 对已有工具暴露/调用者/批准者规则做最小修复；不增加提示词式的“权限控制”，不另建身份系统。
- [ ] 记录协议测试与真客户端测试分别结果；dsh / WorkBuddy 真客户端验证在 1.1.1 范围，1.1.0 提供可验证协议/配置准备结果及明确边界。
- [ ] 审查后提交。

## Task 8: 候选版集成、升级与恢复验收

**Files:**
- Create: scripts/acceptance/run-mp11-acceptance.ps1
- Create: docs/active/delivery/evidence/MP11-ACCEPTANCE.md
- Create: docs/active/delivery/evidence/MP11-RELEASE-NOTES.md
- Modify: .github/workflows/ontology-loop.yml
- Modify: metaplatform-frontend/apps/web/tests/e2e/ontology-relationship-flow.spec.ts
- Modify: metaplatform-frontend/apps/web/tests/e2e/mp11-order-app-flow.spec.ts

**Interfaces:** 统一 runner 接收明确测试库/端口/服务地址，拒绝无 codex_mp11_ 前缀的写测试数据库；运行结果包含 commit、配置摘要、命令、用例、结果和错误。不得把 skipped 或 NOT_EXERCISED 写为通过。

- [ ] 集成新关系、对象创建、数据、应用、官网和 Agent 契约检查，并覆盖现有 ontology-migration-plan.spec.ts。
- [ ] 新库与升级库运行 Customer/Order 样例；重启、同幂等键重放、基数冲突、错列和断连恢复；健康探针辅以实际业务查询。
- [ ] 运行前端类型检查/构建、受影响单元和实际 API/PG 集成/E2E；必要故障只注入独立环境。
- [ ] 独立任务审查以及全部任务后的整体审查，修复阻断项；保留用户原 WIP。
- [ ] 输出候选版说明与可启动预览、部署配置、回滚/补偿说明。目标完成仅指本计划 1.1.0 开发候选版通过；正式部署、72 小时 SLO、用户试用及 1.1.1/1.2 项独立列明，不冒称 GA。

## 执行记录与完成规则

每个任务记录 pending / in_progress / verified / failed、实际提交、检查结果和未通过项。主进度文件为 docs/active/delivery/evidence/MP11-EXECUTION.md；任务 brief/report/review 放本计划专属 .superpowers/sdd 目录。所有 1.1.0 任务验收通过后才 complete Goal；某任务耗时长或单次上下文结束不构成完成。需要人工输入或外部环境改变且连续三轮同一阻塞时，按 Goal 工具规则登记 blocked。