# MetaPlatform Builder V2 Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> 状态：Accepted；2026-10-08 用户已确认具体设计并授权实施，使用本聊天当前隔离工作树。

**Goal:** 将现有 MetaPlatform 本体模块按 V2 原型优化为可真实使用的本体建设工作台。

**Architecture:** 保留八域平台与六域本体的正式路由、Semi 组件及既有后端。以 ONTOLOGY_NAV 派生工作区导航、搜索和面包屑，依次接入模型卡片画布、资源编辑、真实映射和发布流程。业务事实继续由现有 API、WIP 和不可变版本快照管理。

**Tech Stack:** 现有 React 19、TypeScript、Semi、lucide-react、Vite、Vitest、Playwright；后端 Python 3.12、FastAPI、PostgreSQL 16。依赖使用 frontend pnpm-lock 与 backend uv.lock。

**Spec:** [已接受具体设计](../specs/2026-10-08-metaplatform-builder-v2-alignment-design.md)。

## Global Constraints

- 工作目录为 `C:/Users/houuu/.codex/worktrees/242e/2026-07-02-MetaPlatform`，起始 HEAD 为 `9646f018`；保留其他工作树、现有服务、数据库和用户修改。
- 平台八个一级入口不变。本体一级入口直达 `/ontology/model/graph`；`/ontology` 继续为总览，增加 `/ontology/overview` 别名。全站根入口继续 `/home`。
- 本体采用平台 IconRail → 六域左侧工作区导航 → 单资源详情页签，其他域继续原导航。planned 项不显示。
- 本体路径、搜索索引、面包屑和兼容 tab 元数据从 `ONTOLOGY_NAV` 派生；最长路径匹配。页面、选中资源、详情页签和查询视图进 URL。
- 复用现有真实 API、身份、租户上下文、编辑器及治理链；不移植原型合成数据、本地角色、假同步或假快照，不新建平行事实库。
- 颜色和尺寸通过现有 Semi 主题包及应用令牌配置；不更换组件库，不新增 `.semi-*` 内部样式覆盖。
- 水位列声明 DTO 没有 `ts_column` 入参：显示实际配置，不提供假保存。本次不扩大后端业务语义；新增消费的既有端点若未契约化，先同步契约。
- 403/409/422 和辅助读取失败必须可辨认；修改失败保留输入。发布与迁移、模型回滚与实例恢复保持 ADR-0080/0082 的区别。
- 提交按文档/ADR → 契约（必要时）→ 失败测试 → 实现 → 独立验证证据。共享核心文件串行整合，一次只运行一个实施子 Agent，审查者只读。
- 本轮测试资源使用独立 loopback：前端 `59260`、gateway `58110`、auth `58111`、Ont `58017`、PG `55493`、Keycloak `55389`、Redis `55387`；启动前复核端口。测试不得复用共享 `9200/9250/8100/5432`。
- 六组 PostgreSQL 回归、ontology core 浏览器闭环、两个 migration 用例均须实际采集执行且零 skip；分别登记单元/接口替身 UI、本地真实后端、CI、部署与业务验收。
- 主视觉验证尺寸为 `1440`、`1920`，并覆盖 `1024`、`390`；键盘可用，窄屏导航可展开，无文档级横向溢出。

## Task 1: 工作区壳、导航单源与视觉层级

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

**Files:** `pages/ontology/model/{graph/OntologyGraphPage.tsx,OntologyGraphView.tsx}`；新增 `model/graph/{ModelGraphCanvas.tsx,ModelInspector.tsx,model-workbench.css}`；`model/object-types/{ObjectTypesPage.tsx,ObjectTypeDetailPage.tsx}`、`layout/ResourceDetailLayout.tsx`、必要的类型编辑 hook；现有 `components/ObjectTypeEditorV2Drawer.tsx` / `PropertyEditorV2.tsx`；新增对应行为单元测试。

**Interfaces:** 消费 `listObjectTypes/listLinkTypes/getObjectType` 的 Kernel DTO，复用 existing type writer/precheck/WIP 与完整扩展元数据；产出模型卡片、Inspector 及资源切换编辑。其他实例图继续使用 ForceGraph，不改其行为。

- [ ] 写失败用例：选中真实模型显示该类型主键/属性/关系；打开编辑器路由保留选中 RID；详情编辑保留原接口/marking/parent 等扩展字段；读取失败有重试；未保存输入不会静默丢弃。

```tsx
// 使用 hand-authored KernelObjectType fixture 与真实组件；API 外部边界可替身。
fireEvent.click(screen.getByRole('button', { name: '选择模型 客户' }));
expect(screen.getByRole('complementary', { name: '资源属性' })).toHaveTextContent('客户编号');
fireEvent.click(screen.getByRole('button', { name: '打开模型编辑器' }));
expect(screen.getByRole('heading', { name: '客户' })).toBeVisible();
```

- [ ] 记录 RED 后实现卡片 + SVG 关系连线，拖动、缩放、fit、双击/键盘打开、图/资源列表切换；布局状态不写模型数据。图与 Inspector 使用同一 DTO 集合，过滤后计数一致。
- [ ] 模型检查通过既有校验 API，尚未执行时明确显示；请求失败不显示空结果为通过。真实状态和选择 RID 可恢复。
- [ ] 类型详情增加资源列表、业务名/机器名、属性操作、现有真实页签和数据源/动作入口。沿用现有完整编辑器与写入/相似扫描，不建另一份属性事实库。
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
- [ ] 以真实物化结果呈现样本表，加载/空/错误分别显示；保存回读与同步结果来自接口。未保存映射禁止相关同步，切换处理未保存输入。
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
- [ ] 跑受影响单元和 typecheck，自查原两个 migration 浏览器用户操作仍有兼容入口；提交。

## Task 5: 全本体页面一致性与浏览器回归清单

**Files:** `pages/ontology/ontology.css`、`shell/shell.css`、overview/explore/logic/governance 的必要页面自有 CSS；`apps/web/tests/e2e/ontology-builder-v2.spec.ts`、`apps/web/tests/e2e/ontology-ia-v2-navigation.spec.ts` 与受影响旧 spec；专用 `playwright.builder.config.ts`、安全结果清单（必要时），既有 config 与 CI 的最小接入。

**Interfaces:** 消费 Tasks 1–4 工作区与页面，保留 ObjectSet、分析、地图、动作编排、安全与审计操作。浏览器分别验证真实服务与接口替身，不能混称。

- [ ] 检查所有 active 本体页的标题/容器/滚动一致性，复用页面自有类统一 spacing、表格与状态；其他七域不出现本体侧栏。
- [ ] 浏览器写用户行为与请求断言，覆盖建模壳/编辑/映射/发布四段的核心流程、未保存处理、深链与失败态；记录 RED 再修复实际问题。
- [ ] 维持旧路径矩阵与对象消费/Proposal/审计流程，不删测试掩盖退化；更名只改设计变化对应的断言。
- [ ] 显式收集此目录的新增与原 IA 浏览器文件，避免 root testDir 漏采集；给 CI 增加精确入口和结果工件。
- [ ] 跑受影响单元/typecheck/build，生成浏览器清单；提交。

## Task 6: 独立真实栈、最终验收与交付

**Files:** 必要新增 `scripts/ci/run_builder_v2_validation.ps1` 等当前工作树独立资源准备入口；`docs/acceptance/2026-10-08-metaplatform-builder-v2.md`、`docs/acceptance/evidence/2026-10-08-metaplatform-builder-v2/`；必要 CI 入口。此任务不能修改其他任务已审查业务代码；发现问题交回实施 Agent。

**Interfaces:** 消费前五任务最终代码，使用当前 `verify_ont_postgres.py`、`verify_migration_browser.py`、ontology core E2E；资源命名限定 `codex-242e-builder-v2-*`。

- [ ] 按 AGENTS 安装 Node 22/pnpm 与 Python 3.12/uv 锁定依赖；构建 Chromium/esbuild，记录来源与版本。
- [ ] 独立 PostgreSQL 16 容器创建业务测试库/非特权角色；执行六组完整回归并核对 collection/JUnit，不允许环境 skip。

```powershell
mate-platform-backend/.venv/Scripts/python.exe scripts/ci/verify_ont_postgres.py --junit .ci/builder-v2-ont-postgres.xml
```

- [ ] 独立 Keycloak/auth/gateway/Ont/Redis 与前端启动真实登录，使用本工作树源码（source mount 或 native source）。仅使用本轮资源，不能运行现有脚本的共享 Free ports。
- [ ] 采集和执行 ontology core、两个 migration 及 builder/受影响 IA 浏览器；安全保存身份和结果，不含密码/令牌。

```powershell
pnpm exec playwright test --config playwright.migration.config.ts --list --reporter=./migration-list-reporter.ts
pnpm exec playwright test --config playwright.migration.config.ts --workers=1
mate-platform-backend/.venv/Scripts/python.exe scripts/ci/verify_migration_browser.py --junit metaplatform-frontend/test-results/migration.xml
```

- [ ] 全部 unit、typecheck、build 与覆盖四尺寸的实际截图检查；证据区分 API 替身、真实签名身份、真实 PG、本地/CI/部署边界。
- [ ] 生成一次整分支审查包，最有能力的 Reviewer 只读审查；如有 findings，统一交一个 Agent 修复并 scoped re-review。
- [ ] 写验收与复现路径、source commit、数量、剩余限制；保留本任务预览供用户检查，清理仅本任务已确认可清的资源且不删除现存工作树。
- [ ] 全退出条件完成才关闭 goal；真实环境阻断则保留 goal 与确切未完成项，继续可独立工作。
