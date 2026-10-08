# MetaPlatform Full Platform V2 Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> 状态：Accepted；2026-10-08 用户已确认具体设计并授权实施，随后选择按产品重设计文档切换七个一级入口；更新全平台原型后明确选择“七入口，全平台对齐”。使用本聊天当前隔离工作树。
> 顺序：Task 1 原壳基线及其审查修复 → Task 7 七入口修订 → Task 2 模型基线及审查修复 → Task 8 全平台新壳 → Task 10 真实登录身份读取前置修复 → Task 9 新版模型工作区 → Task 3 映射 → Task 4 发布 → Task 5 全平台一致性/集成 → Task 6 验收。后补任务编号保留以追踪既有证据，不重新实施已完成基线。

**Goal:** 按更新的全平台原型对齐 MetaPlatform 所有现有模块的页面结构、视觉与交互，保留用户选定的七入口并接入现有后端。

**Architecture:** 用七个产品入口重新组织既有平台能力，本体工作室按六组建设职责组织；保留正式路由、Semi 组件及既有后端。由单一注册表派生顶部功能组、左侧页面导航、搜索和面包屑；共用页面模式覆盖现有模块，模型采用资源树/卡片画布/Inspector，映射与发布继续接现有 API。业务事实由现有 API、WIP 和不可变版本快照管理。

**Tech Stack:** 现有 React 19、TypeScript、Semi、lucide-react、Vite、Vitest、Playwright；后端 Python 3.12、FastAPI、PostgreSQL 16。依赖使用 frontend pnpm-lock 与 backend uv.lock。

**Spec:** [已接受具体设计](../specs/2026-10-08-metaplatform-builder-v2-alignment-design.md)。

## Global Constraints

- 工作目录为 `C:/Users/houuu/.codex/worktrees/242e/2026-07-02-MetaPlatform`，起始 HEAD 为 `9646f018`；保留其他工作树、现有服务、数据库和用户修改。
- 平台一级入口为工作台、业务应用、对象探索、本体工作室、数字员工、连接与知识、治理与管理。SuperAI 常驻入口和 `/superai/chat` 保留。旧八域的真实能力及旧 URL 保留，不复制事实源。
- 当前视觉/交互参考为更新的 `metaplatform_full_platform_prototype.html`，SHA256 与采用边界见 spec §10。其 97 个合成页面不是新增后台范围；全平台覆盖以源码现有 active 路由清单为准。
- 所有入口采用浅色顶栏、顶部功能组、左侧当前组页面导航及统一工作区。新用户默认浅色，保留已有本地/远端主题与 side/top 偏好；模型额外使用同源资源树，不能叠加旧本体域侧栏。
- 本体一级入口直达 `/ontology/model/graph`；`/ontology` 继续为总览，增加 `/ontology/overview` 别名。全站根入口继续 `/home`。
- 本体工作室六组为概览、业务模型、数据接入、业务动作、变更发布、运行与质量。对象探索为独立消费入口，继续 `/ontology/explore/*`，不套建设侧栏。接口/公理、函数/编排保留高级入口；planned 项不显示。
- 本体路径、搜索索引、面包屑和兼容 tab 元数据从 `ONTOLOGY_NAV` 派生；最长路径匹配。页面、选中资源、详情页签和查询视图进 URL。
- 跨页带入 `typeRef`、可用 `changeRef` 与站内 `returnTo`；保留现有 `class` 参数兼容。返回目标只接受站内路径，不在 URL 放令牌或敏感记录。
- 复用现有真实 API、身份、租户上下文、编辑器及治理链；不移植原型合成数据、本地角色、假同步或假快照，不新建平行事实库。
- 颜色和尺寸通过现有 Semi 主题包及应用令牌配置；不更换组件库，不新增 `.semi-*` 内部样式覆盖。
- 水位列声明 DTO 没有 `ts_column` 入参：显示实际配置，不提供假保存。本次不扩大后端业务语义；新增消费的既有端点若未契约化，先同步契约。
- 403/409/422 和辅助读取失败必须可辨认；修改失败保留输入。发布与迁移、模型回滚与实例恢复保持 ADR-0080/0082 的区别。
- 提交按文档/ADR → 契约（必要时）→ 失败测试 → 实现 → 独立验证证据。共享核心文件串行整合，一次只运行一个实施子 Agent，审查者只读。
- 本轮测试资源使用独立 loopback：前端 `59260`、gateway `58110`、auth `58111`、Ont `58017`、PG `55493`、Keycloak `55389`、Redis `55387`；启动前复核端口。测试不得复用共享 `9200/9250/8100/5432`。
- 六组 PostgreSQL 回归、ontology core 浏览器闭环、两个 migration 用例均须实际采集执行且零 skip；分别登记单元/接口替身 UI、本地真实后端、CI、部署与业务验收。
- 主视觉验证尺寸为 `1440`、`1920`，并覆盖 `1024`、`390`；键盘可用，窄屏导航可展开，无文档级横向溢出。

## Task 8: 更新原型的全平台功能组与页面导航壳

**Files:** `metaplatform-frontend/apps/web/src/components/shell/{domains.tsx,AppShell.tsx,TopBar.tsx,IconRail.tsx,PageTabs.tsx,CommandPalette.tsx,shell.css}`；必要新增 `WorkspaceNavigation.tsx` 与行为测试；`contexts/SettingsContext.tsx`；后端 `mate-tech-iam/api/dashboard.py` 新用户主题回退与定向测试（仅呈现默认值，不改已有偏好、身份或 API 语义）；本体 `layout/{OntologyTabLayout.tsx,OntologySideNav.tsx,OntologyContextBar.tsx,workspace.css}`；导航 ADR/规格及全平台覆盖清单。路径以源码为准，新增组件名称可按职责调整。

**Interfaces:** 消费 Task 7 的七入口注册表和 ONTOLOGY_NAV，保留 DomainDef/Tab 调用者兼容。产出同源 workspace groups/pages、最长路径选择、搜索/面包屑和单一域工作区。所有已有正式页面/旧 URL 可达，OntologyDomainShell 的高度/助手上下文仍工作；模型资源树由 Task 9 消费内容区域尺寸。

- [ ] 先同步新版呈现决定和采用边界；核对路由登记与导航，保存现有 active 路由覆盖清单。未有后端能力的原型页面不生成虚构入口。
- [ ] 写并记录 RED：七入口及 SuperAI 所有现有路径选择对应组/页面，组切换能打开其真实入口，深链不跳首项；对象探索/安全页面保持正确产品归属，无重复本体侧栏。
- [ ] 将注册表中平铺页面按现有职责归组，嵌套页面沿用真实父组；不建立另一份硬编码路由表。顶部展示功能组，左侧只展示当前组页面，细节页签留在资源内部。只有单组的入口保持明确标题和页面入口。
- [ ] 实现深色带标签窄栏、浅色顶栏/组栏/页面导航和浅灰内容区；品牌、搜索、用户菜单、通知、SuperAI 的真实功能保留。side/top 入口偏好继续可用，已有主题不被覆盖，新用户默认 light。
- [ ] 核对真实设置接口成功读取的回退：未知用户 GET/首次 PUT 默认 light，已有 dark/system 记录原样保持，不能用前端替身隐藏服务端默认 dark。定向验证后仅重载本轮独立 auth 源服务以实际取证，其他服务/数据库/工作树保留。
- [ ] 390px 组栏局部滚动，页面导航可展开；真实 Tab、Escape、选择后焦点行为继承 Task 1 修复，不靠测试注入 focus。1024px 与暗色模式仍可辨认；不新增 `.semi-*` 覆盖。
- [ ] 使用同源元数据生成可读面包屑和搜索；保留治理/admin 双前缀、探索助手 canonical context、旧 aliases/query/hash。新壳不存业务事实或伪造工作区/环境状态。
- [ ] 跑导航/设置 focused unit 与 typecheck，self-review 后提交。实际四尺寸与全入口浏览器交 Task 5/6。

## Task 10: 真实登录用户信息与编辑身份前置修复

**Files:** `mate-platform-backend/services/auth-service/src/mate_auth_service/main.py` 及对应当前测试；`metaplatform-frontend/packages/shared/src/components/SharedLoginPage.tsx` 与行为测试；`apps/web/src/pages/ontology/hooks/editorSession.tsx`、现有编辑器身份不可用提示和覆盖测试；必要登录契约核对（不新增端点/字段/角色）。

**Interfaces:** 现有 IAM/dashboard password grant 登录已调用 OIDC userinfo，但遗漏 `openid` 导致当前 provider 返回 403/空用户 ID。消费已有 AuthResponse.userId/user.id、accessToken 和真实 tenant 上下文；产出正常登录的稳定用户 ID 与按身份隔离编辑会话。保留当前后台最佳努力 HTTP 200/SUCCESS、DTO、令牌和错误流程、签名校验和授权语义；无 subject 时移除 dashboard 按用户名生成的替代 ID，与 IAM 一样返回空 ID，由 UI 提示重试。

- [ ] 以已保存的独立 provider 比较探针为 RED 前置证据：省略范围时 userinfo403/无 subject，openid 时 userinfo200/有 subject；不打印令牌、口令或私人信息。补登录 HTTP 边界测试检查实际 password grant 请求及返回用户 ID。
- [ ] 补齐现有 IAM 和 dashboard 人员登录的 OIDC 身份信息范围；不请求新增角色/权限，不为 token 注入用户/tenant，不更换 provider，不改 legacy/signature 标志，不扩大身份协议。
- [ ] UI 正常/SSO 登录缺少有效用户 ID 或令牌时不建立空 ID 的个人会话，明确错误与重试，保留用户输入；成功路径复用真实 DTO，不用用户名/演示账户伪造 ID。
- [ ] 编辑缓存拒绝空用户 ID/空 tenant；身份不可用时明确跨页输入无法恢复、给出保存/重新登录路径，modal dirty guard 仍有效。补两个同 tenant 无有效 ID 的缓存隔离测试，禁止复用先前个人缓存。
- [ ] 运行 Source auth、SharedLogin 和受影响 editor focused 测试/typecheck，自查并按明确文件提交；契约 DTO/接口不变时记录核对而不机械改契约。
- [ ] Controller 仅重载已确认所有权的独立 auth，执行真实 IAM 登录→稳定用户 ID→设置成功读取 light→浏览器四尺寸；没有 ID 时必须失败而非伪造 UI 身份。保留原 core/migration 与最终完整回归。

## Task 9: 更新原型的模型资源树与工作区层次

**Files:** `pages/ontology/model/{OntologyGraphView.tsx,graph/ModelGraphCanvas.tsx,graph/ModelInspector.tsx,graph/model-workbench.css}`，必要新增模型资源树；`model/object-types/ObjectTypeDetailPage.tsx` 与资源布局自有样式；必要 `api/ont/kernel.ts` 已有列表分页消费及契约参数核对；相关行为测试。

**Interfaces:** 消费 Task 2 的同源模型 DTO、选中 typeRef、图/列表筛选、校验与编辑链，以及 Task 8 新壳。只调整最新版资源布局及用户选择，不改保存/WIP/版本语义，不复制 ObjectType 状态。

- [ ] 对照新版 graph/type 实际截图增加内部左侧资源树、中央点阵卡片画布和右侧 Inspector；资源树选择、筛选、图/列表计数与 URL 使用同一 DTO 和 state。
- [ ] 核对既有列表 API 分页并完整消费当前可见活动类型/关系；不能以默认首批结果推断全量计数或当前版本。覆盖超过首批的类型及 archived RID 查看时的同族当前标记，不以最大版本号替代 checksum。
- [ ] 写并记录 RED：从资源树选择实际类型立即更新 Inspector 与 typeRef，刷新/返回恢复选择；树筛选和图列表不相互矛盾，不触发模型写入。
- [ ] 类型详情采用新版标题、属性表、六个局部资源页签与资源切换；保留 Task 2 全字段编辑、辅助错误、候选创建锁定、会话内输入保留和旧深链。
- [ ] 初始/失败检查仍明确，不搬入原型固定 Owner、API 名编辑、demo 状态、草稿数或检查结果；不允许未有契约字段假保存。
- [ ] 四尺寸中资源树/Inspector 可折叠访问，画布可局部滚动；适应画布考虑宽和高，键盘可选资源/打开编辑。图缩放/拖动只影响界面布局。
- [ ] 跑实际组件行为测试和 typecheck，自查后提交；最终浏览器用真实当前模型加 hand-authored HTTP 边界 fixture。

## Task 7: 用户后补的七入口产品导航与职责归组

**Files:** `components/shell/{domains.tsx,IconRail.tsx,TopBar.tsx,CommandPalette.tsx,CopilotDock.tsx,shell.css}`；`pages/ontology/navigation.ts`、`layout/{OntologyTabLayout.tsx,OntologyContextBar.tsx,OntologySideNav.tsx,workspace.css}`；必要 `routes/ontology.tsx` 兼容别名；导航单元与 E2E；ADR-0069、IA v2 规格、`docs/active/specs/2026-09-14-ui-redesign/DESIGN-SPEC.md` 和文档索引。

**Interfaces:** 消费 Task 1 的工作区/最长路径基础。产出单一平台产品域注册表（七个菜单项，SuperAI 为常驻能力）、`resolveDomain(pathname)` 的最长 route-prefix 归属和同源命令索引；保留现有 DomainDef/Tab 对 PageTabs 消费者的接口。ontology assistant context 仍由既有域壳发布，不因对象探索归组丢失。

- [ ] 先同步 ADR/导航规格的后补用户决定，明确七入口覆盖初始八入口呈现，不把原提案全部记为已接受后台需求。
- [ ] 写并运行 RED：所有现有路径在新七入口下归属正确，尤其 `/ontology/explore/*` 属于对象探索、`/admin/*` 和 `/gov/*` 属于治理与管理；SuperAI 完整路由与常驻入口仍可达；不存在复制的对象探索/建设菜单。

```ts
expect(resolveDomain('/ontology/explore/objectset')?.label).toBe('对象探索');
expect(resolveDomain('/admin/org/users')?.label).toBe('治理与管理');
expect(resolveDomain('/gov/tech/components')?.label).toBe('治理与管理');
```

- [ ] 七个一级入口按用户选定顺序呈现：工作台、业务应用、对象探索、本体工作室、数字员工、连接与知识、治理与管理。保留原有效页面与 URL；navMode 的 side/top 两种呈现都正确。
- [ ] 全局 SuperAI 支持打开现有 Copilot 与完整 `/superai/chat`；搜索仍可发现该会话入口。不能让移出一级菜单的 SuperAI 旧 URL 变成无域/不可访问。
- [ ] 本体六组按概览、业务模型、数据接入、业务动作、变更发布、运行与质量归组；同步、模型校验、执行记录、审计、使用量进入运行与质量；模型检查同义项收口同一实现，旧深链继续可达；安全策略链接同一治理事实。
- [ ] 对象探索 `/ontology/explore/*` 保留 OntologyDomainShell 上下文写入与高度约束，但不显示本体建设侧栏。对象浏览、ObjectSet、聚合、地图来自同一正式路由配置。
- [ ] 菜单不能创建新原型身份、角色或前端权限。已有角色/权限消费可复用；没有现行权限映射的角色裁剪不编造规则，服务端授权继续为准。
- [ ] 跑 Node 22 focused unit/typecheck，旧路径矩阵与窄屏焦点修复不能退化；self-review 后提交。Task 6 执行真实浏览器、全七入口检查与旧路径回归。

## Task 1: 工作区壳、导航单源与视觉层级

> 本任务的八入口/旧六域术语是原始已实施基线；后补七入口与新职责分组由 Task 7 覆盖。保留原 brief/review 作为历史证据。

**Files:** `docs/active/decisions/ADR-0069-ontology-ia-v2-workspace-navigation.md`、`docs/active/specs/2026-09-18-ontology-ia-v2-design.md`、`docs/README.md`；`metaplatform-frontend/apps/web/src/pages/ontology/navigation.ts`、`layout/OntologyTabLayout.tsx`、新增 `layout/OntologySideNav.tsx` / `layout/OntologyContextBar.tsx` / `layout/workspace.css`；`components/shell/{domains.tsx,AppShell.tsx,TopBar.tsx,IconRail.tsx,shell.css}`、`routes/ontology.tsx`；导航单元和浏览器用例。

**Interfaces:** 消费 `ONTOLOGY_NAV: OntologyNavItem[]`；产出 `resolveOntologyNav(pathname)` 的最长匹配、`ontologyBreadcrumb(pathname)`、派生 `DomainDef.tabs` 与 workspace 模式。现有 `OntologyDomainShell` 的 assistant context 写入保持。

- [ ] 同步 ADR/规格：追加 2026-10-08 导航呈现决定，覆盖 2026-09-24 横向附录而保留历史；文档入口引用新规格/计划。
- [ ] 先以导航用户行为写失败测试：对象详情深链不能高亮总览；未实现页不能进入导航；工作区点击关系类型与浏览器返回正确；其他域仍渲染其 PageTabs。

```tsx
expect(resolveOntologyNav('/ontology/model/object-types/ont.t.obj.customer.v1/properties')?.item?.key)
  .toBe('object-types');
expect(ontologyBreadcrumb('/ontology/data/mappings').map(c => c.name))
  .toEqual(['数据映射', '对象映射']);
```

- [ ] 运行并记录 RED：`pnpm --filter @mate/web exec vitest run src/components/shell/ontology-navigation-mode.test.tsx` 及新 navigation 用例，失败需来自新行为未实现。
- [ ] 从 ONTOLOGY_NAV 派生本体域 tabs，排序模型工作台为语义模型首项，规范原型标签；保留已实现的分析/地图/编排/使用量。本体一级 path 为 graph；总览仍保留原路由。
- [ ] 使用现有 workspace 模式抑制 PageTabs；加六域侧栏、上下文面包屑与可折叠窄屏导航；改造平台品牌、深色定位区域和本体白色工作区，使用主题令牌与自有类。
- [ ] 更新既有 navigation E2E 的用户操作断言，保留深链与旧路由验证，不用 CSS 文本测试。
- [ ] 跑受影响单元及 typecheck，检查 diff，无失败后分开提交 RED 和 feature；完整浏览器在 Task 6 当前环境执行。

## Task 2: 真实模型卡片画布与类型编辑工作台

**Files:** `pages/ontology/model/{graph/OntologyGraphPage.tsx,OntologyGraphView.tsx}`；新增 `model/graph/{ModelGraphCanvas.tsx,ModelInspector.tsx,model-workbench.css}`；`model/object-types/{ObjectTypesPage.tsx,ObjectTypeDetailPage.tsx}`、`layout/ResourceDetailLayout.tsx`、必要的类型编辑 hook；现有 `components/ObjectTypeEditorV2Drawer.tsx` / `PropertyEditorV2.tsx`；`api/ont/kernel.ts` 与 `contracts/openapi/services/ont.yaml` 的本任务实际消费端点；新增对应行为单元测试。

**Interfaces:** 消费 `listObjectTypes/listLinkTypes/getObjectType` 的 Kernel DTO，复用 existing type writer/precheck/WIP 与完整扩展元数据；产出模型卡片、Inspector 及资源切换编辑。类型历史改为 `listVersions` 的 KernelVersion 快照（当前 VersionHistory 仍错误读取 live 类型列表，不能沿用该假历史）。其他实例图继续使用 ForceGraph，不改其行为。

- [ ] 写失败用例：选中真实模型显示该类型主键/属性/关系；打开编辑器路由保留选中 RID；详情编辑保留原接口/marking/parent 等扩展字段；读取失败有重试；未保存输入不会静默丢弃。

```tsx
// 使用 hand-authored KernelObjectType fixture 与真实组件；API 外部边界可替身。
fireEvent.click(screen.getByRole('button', { name: '选择模型 客户' }));
expect(screen.getByRole('complementary', { name: '资源属性' })).toHaveTextContent('客户编号');
fireEvent.click(screen.getByRole('button', { name: '打开模型编辑器' }));
expect(screen.getByRole('heading', { name: '客户' })).toBeVisible();
```

- [ ] 记录 RED 后实现卡片 + SVG 关系连线，拖动、缩放、fit、双击/键盘打开、图/资源列表切换；布局状态不写模型数据。图与 Inspector 使用同一 DTO 集合，过滤后计数一致。
- [ ] 新增实际消费的校验/WIP 调用前，核对现有 DTO 与 operationId 并同步缺失 OpenAPI 登记；不改变后端语义。
- [ ] 模型检查通过既有校验 API，尚未执行时明确显示；请求失败不显示空结果为通过。真实状态和选择 RID 可恢复。
- [ ] 类型详情增加资源列表、业务名/机器名、属性操作、现有真实页签和数据源/动作入口。沿用现有完整编辑器与写入/相似扫描，不建另一份属性事实库。
- [ ] 来源绑定页签真正读取 backing datasource，将物化样本分开展示；跨页入口带入选中类型与返回位置，旧 datasources/history 深链兼容。
- [ ] 历史读取 listVersions 并复用独立 VersionHistory 组件，供 Task 4 发布历史接入；辅助错误保留明确 partial/forbidden/unavailable，异步请求用代次或取消防止旧资源响应污染。
- [ ] 编辑器关闭/切换处理未保存状态，保存失败保留草稿。复用现有 WIP 暂存，发布入口导向现有治理流程，不能把直接发布叫“保存草稿”。
- [ ] 运行受影响单元、typecheck；自查 Loading/空/403/422 状态和 narrow 布局后提交。

## Task 3: 真实来源映射与样本检查

**Files:** `pages/ontology/data/mappings/{ObjectMappingsPage.tsx,BackingDatasourcePanel.tsx,backing-datasource.css}`；必要新增映射表单/样本布局组件与单元测试；`api/ont/kernel.ts` 仅按实际契约更新 typing；`contracts/openapi/services/ont.yaml` 对本任务实际消费的既有 binding/materialization/sync 端点补登记（如缺失）。

**Interfaces:** 消费 `KernelObjectType.properties`、`KernelBackingDatasource`、`BackingDatasourceCreate` 和 `getMaterialization`；提交 `field_mapping` 为属性完整 RID → 来源列，kind 对齐真实 `pg_table` 语义。preview 不调用 sync。

- [ ] 核对 API DTO、repository 与 OpenAPI，缺失契约先补，保持现有 operationId 与语义。
- [ ] 写失败用例：重复目标/空来源阻断提交；已保存映射可读取编辑；类型 A→B 切换不提交 A 配置；样本读取不触发同步；API 错误保留输入。

```ts
// 捕获真实 API client 送出的外部 HTTP 请求体，不断言 mock 的存在。
expect(requestBody.field_mapping).toEqual({ 'ont.t.prop.crm.customer-name.v1': 'legal_name' });
expect(requestBody).not.toHaveProperty('ts_column');
```

- [ ] 记录 RED；实现来源与类型资源选择、属性行映射、主键/必填提示、dsn_env 引用、真实服务端水位展示；禁止无契约水位编辑。
- [ ] 当前保存接口会把已有自定义水位重置为 `updated_at`；阻止此类来源保存修改，保留输入并说明实际限制，读取样本和同步已保存配置仍可用。允许明确新建另一来源，不加 `ts_column` 入参或改变后端语义；用实际请求断言证明阻断无写入。
- [ ] 以真实物化结果呈现样本表，加载/空/错误分别显示；保存回读与同步结果来自接口。未保存映射禁止相关同步，切换处理未保存输入。
- [ ] 进入映射/同步时尊重 URL 对象上下文，不默认改成首条类型；回到原资源保留页签/筛选。没有源字段元数据契约时不伪造字段下拉或样本来源。
- [ ] 跑 API 请求/组件单元与 typecheck；提交契约/RED/feature，数据库与真实同步验收交给 Task 6。

## Task 4: 草稿校验、影响、确认与发布组织

**Files:** `pages/ontology/governance/{drafts/DraftsPage.tsx,releases/ReleasesPage.tsx,governance.css}`、`components/SchemaWipCard.tsx`、类型版本历史组件；必要 `api/ont/kernel.ts` typing 与已消费 WIP/validate/branch/diff/rollback 契约；对应行为测试。

**Interfaces:** 消费 `listSchemaWip/validateObjectTypeModel/assessMigration/applySchemaWip/listVersions/listMigrationRuns`；版本仍由不可变 snapshot 与 live checksum 判定；MigrationPlan 继续服务端校验，不增加 backend 迁移特性。

- [ ] 先补本任务实际消费的缺失契约，不改变后端行为。
- [ ] 写失败用例：未校验草稿不能从新增步骤直接发布；修改/切换后旧评估失效；403/409/422 保留草稿；发布后类型历史与版本页同源；不同类型快速切换不展示旧响应。

```tsx
expect(screen.getByRole('button', { name: '确认发布' })).toBeDisabled();
fireEvent.click(screen.getByRole('button', { name: '校验草稿' }));
// 后端预检成功后再显示影响与确认，不修改实例。
```

- [ ] 记录 RED；把草稿审阅/校验/影响/确认/结果呈现为清晰步骤，以类型/快照选择代替主要手填 RID；高级标识可查看。
- [ ] 保留破坏性二段确认、模型冲突、迁移执行与记录。只显示真实结果，失败保持可重试，修改输入使旧结果失效。
- [ ] 类型详情历史与发布历史均使用 listVersions，清楚标记模型回滚范围；不要顺带实现 R2–R6 后台。
- [ ] 同源历史组件复用 Task 2 的组件；发布/校验接受并保留 typeRef、changeRef（实际已有引用时）、returnTo，失败与陈旧数据不显示成暂无数据。
- [ ] 跑受影响单元和 typecheck，自查原两个 migration 浏览器用户操作仍有兼容入口；提交。

## Task 5: 全平台页面一致性、集成修复与浏览器清单

**Files:** 共享 `components/{PageHeader,DataTablePro,EmptyState}` 与实际目录页复用的卡片/状态组件（以源码路径为准）；`pages/{home,apps,agents,ki,gov,admin,superai,ontology}` 必要页面与自有 CSS；`shell/shell.css`；`apps/web/tests/e2e/{ontology-builder-v2,platform-builder-v2,ontology-ia-v2-navigation}.spec.ts` 与受影响旧 spec；专用 `playwright.builder.config.ts`、安全覆盖清单、既有 config 与 CI 最小接入。

**Interfaces:** 消费 Tasks 1–4、7–9 工作区与页面，保留所有已登记平台能力、ObjectSet、分析、地图、动作编排、安全与审计操作。浏览器分别验证真实服务与接口替身，不能混称。覆盖清单记录当前路由、原型模式映射、实际适配与验证种类，不将深链参数实例无限展开。

- [ ] 审核全平台 active 路由与页面模式，采用共享页头、面板、卡片/表格和状态；必要页局部适配。工作台、应用、员工、知识集成、治理、SuperAI 及本体每个入口均有实际模式映射和可达验证，不以壳统一代替页面适配。
- [ ] 全局七个入口与六组建设职责一致；对象消费与模型定义视图分开，其他产品入口不出现建设侧栏。总览呈现继续建设、具体阻断与下一步，不编造负责人或健康结论。
- [ ] 对照新版工作台/应用/员工/会话截图优化现有实际页面：真实汇总/待办/继续工作、目录卡片/列表及配置/运行入口、会话列表/对话/上下文。其余页面使用同一页头/状态/表格模式，保留自身真实业务操作，不添加无契约演示功能。
- [ ] 定向定位并修复已复现的 `ProposalConfirmDrawer.test.tsx` 确认/执行用例失败；以服务端真实确认/执行状态和原 core 语义决定修复，不删断言或跳过用例。记录 RED/GREEN 与实际 source attribution。
- [ ] 浏览器写用户行为与请求断言，覆盖建模壳/编辑/映射/发布四段的核心流程、未保存处理、深链与失败态；记录 RED 再修复实际问题。
- [ ] 全平台浏览器覆盖七入口及常驻 SuperAI、顶部组切换、左侧页面、旧深链、主题/入口偏好、读取失败重试、键盘窄屏；非本体未启动服务只用 HTTP 边界替身，记录该边界，不请求共享端口。
- [ ] 维持旧路径矩阵与对象消费/Proposal/审计流程，不删测试掩盖退化；更名只改设计变化对应的断言。
- [ ] 显式收集此目录的新增与原 IA 浏览器文件，避免 root testDir 漏采集；给 CI 增加精确入口和结果工件。
- [ ] 跑受影响单元/typecheck/build，生成浏览器清单；提交。

## Task 6: 独立真实栈、最终验收与交付

**Files:** 必要新增 `scripts/ci/run_builder_v2_validation.ps1` 等当前工作树独立资源准备入口；`docs/acceptance/2026-10-08-metaplatform-builder-v2.md`、`docs/acceptance/evidence/2026-10-08-metaplatform-builder-v2/`；必要 CI 入口。此任务不能修改其他任务已审查业务代码；发现问题交回实施 Agent。

**Interfaces:** 消费所有实施任务最终代码，使用当前 `verify_ont_postgres.py`、`verify_migration_browser.py`、ontology core E2E；资源命名限定 `codex-242e-builder-v2-*`。

- [x] 按 AGENTS 安装 Node 22/pnpm 与 Python 3.12/uv 锁定依赖；构建 Chromium/esbuild，记录来源与版本。
- [x] 独立 PostgreSQL 16 容器创建业务测试库/非特权角色；执行六组完整回归并核对 collection/JUnit，不允许环境 skip。

```powershell
mate-platform-backend/.venv/Scripts/python.exe scripts/ci/verify_ont_postgres.py --junit .ci/builder-v2-ont-postgres.xml
```

- [x] 独立 Keycloak/auth/gateway/Ont/Redis 与前端启动真实登录，使用本工作树源码（source mount 或 native source）。仅使用本轮资源，不能运行现有脚本的共享 Free ports。
- [x] 采集和执行 ontology core、两个 migration 及 builder/受影响 IA 浏览器；安全保存身份和结果，不含密码/令牌。

```powershell
pnpm exec playwright test --config playwright.migration.config.ts --list --reporter=./migration-list-reporter.ts
pnpm exec playwright test --config playwright.migration.config.ts --workers=1
mate-platform-backend/.venv/Scripts/python.exe scripts/ci/verify_migration_browser.py --junit metaplatform-frontend/test-results/migration.xml
```

- [x] 全部 unit、typecheck、build 与覆盖四尺寸的实际截图检查；覆盖本体五段、七产品入口和常驻 SuperAI 代表页面、全平台 active 路由清单。证据区分 API 替身、真实签名身份、真实 PG、本地/CI/部署边界。
- [x] 生成一次整分支审查包，最有能力的 Reviewer 只读审查；如有 findings，统一交一个 Agent 修复并 scoped re-review。
- [ ] 写验收与复现路径、source commit、数量、剩余限制；保留本任务预览供用户检查，清理仅本任务已确认可清的资源且不删除现存工作树。
- [ ] 全退出条件完成才关闭 goal；真实环境阻断则保留 goal 与确切未完成项，继续可独立工作。
