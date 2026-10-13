# Task 4 independent review

- Spec compliance: ❌ Issues found — Task 4 的并发锁序与“并发冲突 + 破坏性确认”组合恢复路径需要修复。
- Task quality: Needs fixes.
- Severity counts: Critical 0 / Important 2 / Minor 1.
- Fixed range: Base `4253a4fe008cc94467245f8c629800f54db2f8ee`; Head `1a3bfebc30e3c92fc6eb1eda0afd65e54d5117db`.

## Strengths and checked requirements

- `mate-platform-backend/packages/mate-kernel/src/mate_kernel/ontology/api.py:37`、`mate-platform-backend/packages/mate-kernel/src/mate_kernel/ontology/in_memory.py:193`、`mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/pg_repo.py:1689`: ObjectType 新建意图贯穿协议及两种存储实现；默认 upsert 的兼容语义保留。PG 对同 RID 的并发创建既有事务锁，也有 INSERT 冲突分支 `WHERE NOT create_only` 最终防线（`pg_repo.py:1806`），不会仅依赖 API 预读。
- `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py:1559`、`:1625`、`mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/pg_repo.py:4410`: strict-new 保存入实际 schema-WIP，恢复列表包含意图，apply 使用同一事务内校验和校验；重存保留已有草稿基线，明确区分 status 元数据与草稿存储。冲突保留赢家及草稿有回归断言。
- `mate-platform-backend/packages/mate-tech-ont/tests/test_mp11_object_type_creation.py:48`、`:59`、`:71`、`:99`、`:114`: 回归覆盖普通编辑、重复 RID、两个竞争创建、WIP 恢复后竞争创建、写入时校验和再检查、两个关系端点的版本发布及新关联。真实 PG fixture 限定 127.0.0.1:55497 和 codex_mp11_ 数据库前缀（`:35`）。
- `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py:1566`、`:1617`、`:1653`、`:1859`: 写操作通过现有 platform.write 与租户边界；草稿 author 来自验证后的 ctx。WIP DELETE 放在贪婪 ObjectType DELETE 前，已有路径及 operationId 保留。辅助 mutation 的权限收紧属于已批准范围。
- `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py:4993`、`:5027`: class inspect 明确隔离租户，ActionType.on 使用 ClassRef.rid 匹配；编辑器 `metaplatform-frontend/apps/web/src/pages/ontology/components/ObjectTypeEditorV2Drawer.tsx:382` 读取实际动作引用，失败阻止发布并显示未知，而非伪造 0 条。
- `metaplatform-frontend/apps/web/src/pages/ontology/OntologyModelingPage.tsx:402`、`:442`、`:451`: 候选命中保持抽屉输入；继续创建返回表单；复用读取已存在类型，不再为未保存的源对象调用 merge。`ObjectTypeEditorV2Drawer.tsx:231`、`:261`、`:369` 提供恢复、离开保护、保存草稿、预检与发布路径。
- `metaplatform-frontend/apps/web/src/pages/ontology/components/ObjectTypeEditorV2Drawer.tsx:518`、`:624`、`:663`: 基础/高级渐进显示，名称/标识及属性问题就地提示，实际属性行可见；读取 schema 拒绝缺少 discovered_at 的响应。真实源端契约与采集仍按 Task 5 边界处理。
- Required file accounting: brief 的 9 个指定文件均有相应 diff；额外协议、OpenAPI 和 E2E 文件共 3 个符合 controller 的明确授权，合计 12 个文件，未发现未经授权的功能扩张。

## Important findings

### I1. 同族发布新增的关系定义锁与多操作 edit-set 形成反向锁序

- Primary changed location: `mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/pg_repo.py:1705`。
- Supporting locations: 同文件 `:1737`、`:6709`、`:6712`、`:6779`、`:3420`。
- 发布事务先对引用旧版本的 LinkType 取独占 definition advisory lock（1705），随后迁移 ont_individual.class_rid（1737），需要对应 individual 行锁。现有 Action/edit-set 在 ops 循环中执行 set_property 时先持 individual FOR UPDATE（6712），再执行 add_link 时调用 _lock_link_endpoints（6779），其第一步取得同一 LinkType 的共享 definition lock（3420）。
- 可达 HTTP 入口：`v2_kernel/api.py:2945` 的 POST /action-types/{rid}/apply-edit-set 在 `:2986` 调用 apply_edit_set_now，传入 `payload.edits`；`pg_repo.py:6609` 确认 proposal 后 `:6610` 执行，edit-set 执行器 `:6617` 组装 ops。`:6706` 仅创建一个 conn，`:6708` 同一 cursor 内依次执行 ops；`:6895` 才统一 commit，异常 `:6897` rollback，因此 set_property 的行锁不会在后续 add_link 前释放。
- 可达交错：edit-set 已锁住旧版本实例 I；supersede 获得引用 I 的关系定义 L 独占锁并等待迁移 I；edit-set 继续 add_link 并等待 L。两事务形成环，PostgreSQL 会终止其中一个。schema-definitions 锁只覆盖新定义写入，edit-set 没有取得该锁，因此它不能打断此环。普通 create_link_instance 的 definition → endpoint → individual 顺序本身与发布方向一致，但不能证明整个写入接口族安全。
- 用户影响：并发业务动作与模型发布可能失败并回滚，违反本任务明确要求保留安全锁序。已有测试只检查 supersede 与新关系定义交错，未覆盖这个复合写入口。
- 最窄修复建议：在 _execute_edit_set_proposal 的同一事务开始、任何 individual 写入之前，取得当前租户共享 schema-definitions 锁并持有到提交；它与 supersede 的独占 schema 锁互斥，可先序列化这两类事务，足以打断这里的环，不必扩大普通 create_link_instance 的锁范围。另一方案是提前统一、排序取得 edit-set 本次关系定义锁。不要通过换成“先迁移 individual 后锁 L”修复，因为那会与 create_link_instance 当前顺序冲突。增加一次有屏障控制的真实 PG 双连接用例：set_property + add_link 与同族发布并发，两者不能死锁，结果必须一致。审查中未运行该新用例，此结论来自具体事务锁顺序。

### I2. 最新基线重试遇到破坏性确认后丢失 checksum，无法完成恢复

- Primary changed location: `metaplatform-frontend/apps/web/src/pages/ontology/components/ObjectTypeEditorV2Drawer.tsx:393`。
- Supporting locations: 同文件 `:395`、`:755`、`:787`；`mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py:1720`。
- 复现条件：用户从基线 A 编辑并做破坏性变更；他人更新模型形成 B；首次发布 409；用户比较最新模型并点击“使用最新基线重试发布”。该按钮只把 B 放入这次 submit 的第三个临时参数，并未保存到 baseline 或待确认请求中。
- 服务端以 B 验证成功后返回 destructive_confirm_required。用户输入名称并点击“确认重发”时，755 只调用 submit(confirmInput.trim())；393 的 retryChecksum ?? baseline 因而回退 A。服务端先做基线检查再做破坏性确认，返回版本冲突。再次点击最新基线重试又不携带 confirm_name，再次进入确认，正常 UI 无法完成这组组合恢复。
- 用户影响：单独冲突恢复、单独破坏性确认都可工作，但常见组合导致用户保留的修改无法发布，与任务的可理解并发恢复和保留二次确认语义不符。
- 建议：显式存储用户已比较的 retry baseline，并让破坏性确认重发携带同一 checksum；后续新冲突仍需重新比较。补一个 UI 行为用例串起 A → B → 409 → 比较 → 破坏性确认 → 成功；现有后端显式 checksum 回归不覆盖 UI 两阶段参数丢失。审查中未重复跑已报告套件。

## Minor findings

### M1. 已报告验证输出含多类 warning，尚未达到 pristine output

- Location: `.superpowers/sdd/2026-10-11-metaplatform-product-v1.1-implementation/task-4-report.md:34`。
- 报告明确列出 FastAPI on_event/Starlette httpx 弃用、fixture HMAC 长度、FORCE_COLOR/NO_COLOR 冲突及 Vite 大 chunk warning。本审查按规则记录为 Minor，不将其解释成断言失败，也不把既有噪音升级为本任务产品阻断。
- Triage: fixture 密钥长度及颜色变量冲突可在测试运行配置中消除；弃用项跟随依赖升级处理；large chunk 记录为前端体积基线并在合适性能任务处理。不要全局屏蔽 warning，也不要因此重跑整套验证。

## Explicit warning boundaries

- ⚠ Task 5：`ObjectTypeEditorV2Drawer.tsx:639` 校验 discovered_at，仅凭 UI/mock 用例无法证明注册源的真实 schema importer、trace_id 与字段真实性。`task-4-report.md:58` 已指定 Task 5/8 的真实源到属性 E2E 责任；此处不冒称通过。
- ⚠ Task 6：`ObjectTypeEditorV2Drawer.tsx:782` 明确显示应用引用尚未验证。真实同租户 AppHub 反向绑定接口及该面板接线属于 Task 6（`task-4-report.md:59`），ONT-03 全目标验收仍未完成。
- ⚠ Task 8：`task-4-report.md:55` 的 JWT fixture signature bypass 不构成真实 Keycloak 登录证据；E2E runner/CI 集成、真实应用/动作引用 E2E、已知全前端 fixture 基线由 Task 8 收口（`:33`、`:59`）。
- ⚠ 已报告测试状态：后端 150 passed / 4 InMemory-only skips（`:27`），聚焦 UI 24 passed（`:28`、`:68`），真实浏览器 1 passed（`:66`），typecheck/build 通过。这些是实现报告证据，本审查没有将其重新执行或扩大为完整业务 Goal/正式 Gate/发布通过。

## Review scope and focused checks

- 读取顺序：task-4-brief.md、global-constraints.md、task-reviewer-prompt.md、task-4-report.md 和固定 review-4253a4fe..1a3bfebc.diff。首次 diff 传输截断；获 controller 许可后只补读未显示的中段。未重新生成 diff、未运行 git 命令、未读全计划/历史。
- Named risk 1 — cross-file/API lock ordering: 对 pg_repo 的 create_link_instance（3322–3365）、_lock_link_endpoints（3413–3422）及 Action/edit-set 循环（6650–6688、6709–6730、6738–6818）做聚焦检查；仅补齐 diff 截断在函数中段的 supersede 实例迁移（1716–1766）。结果：普通关系实例顺序一致，复合 edit-set 存在 I1。
- Named risk 2 — native back guard eager registration: `metaplatform-frontend/apps/web/src/App.tsx:11` 静态导入 ontologyRoutes，`:112` 才在渲染树创建 BrowserRouter；`src/routes/ontology.tsx:17` 静态导入 ObjectTypesPage；其 `:6` 静态导入 OntologyModelingPage；`OntologyModelingPage.tsx:25` 静态导入编辑器。编辑器 `:51` 在模块求值时注册 popstate，因此当前 eager 链确实先于 BrowserRouter 挂载。取消/确认 native back 的真实浏览器用例位于 `tests/e2e/ontology-object-creation-flow.spec.ts:49`。未来 lazy 化会破坏这一依赖，但本次未发现当前注册顺序问题。
- Function-context completion: 为判定 I2，仅补读 diff 未展示的破坏性确认按钮 730–765；没有重读完整已改文件。其余结论基于固定 diff 的已见上下文。
- 未派子代理；未修改生产源码、index、HEAD、branch；未连接或修改数据库、预览服务、运行容器；未重跑报告中的套件/build。唯一写入为本报告。

## Assessment

Task quality: Needs fixes. 严格新建和 WIP 原子保护、租户/权限检查、两端关系版本迁移及真实浏览器基本链路有实质改进；两个具体组合场景仍分别造成事务死锁与发布恢复阻断。修复 I1/I2 后针对这两个新疑点验证，再复审对应变化；跨任务 ⚠ 不作为 Task 4 本身的新增缺陷计数，也不能用于宣称全目标完成。
