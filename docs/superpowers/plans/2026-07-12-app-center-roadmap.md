# 应用中心 v1.0.x 推进路线图（5 个 Phase）

> 基于 `MetaPlatform平台规划与技术架构.v2.md` 和 `docs/v1.0.x/v1.0.1/` 用户故事，按“主链路能跑通”原则划分 5 个阶段。

---

## 整体目标

让应用中心从“页面骨架”进入“可用 Demo”状态：

1. 业务对象有真实字段。
2. 表单能拖字段、能渲染、能提交。
3. 列表能查数据、能分页/排序/过滤/导出。
4. 流程能发起、能审批、有待办。
5. 应用能发布、能切换环境、能回滚。

完成这 5 个 Phase 后，应用中心即达到 **v1.0.1-v1.0.2 可演示** 水准。

---

## Phase 1：业务对象字段管理（当前）

**目标**：补齐 `业务数据建模` Tab，让每个对象可以增删改查字段。

**关键改动**：
- 前端：`DataModeling.tsx` 增加字段入口
- 前端：新建 `ObjectFieldPanel.tsx` 字段管理面板
- 后端：复用已有 `/ontology/objects/:id/properties` CRUD（已实现）

**验收标准**：
- 在业务数据建模页创建一个对象后，可为其添加 5 个以上不同类型字段。
- 字段保存后刷新列表，`properties_count` 数字正确更新。
- Playwright 脚本通过。

**阻塞风险**：低。后端接口已存在。

**对应 v1.0.x 规划**：v1.0.1 US-103「配置业务对象与字段」。

---

## Phase 2：表单编辑器与对象字段绑定 + 表单渲染/提交

**目标**：让表单页面能真正基于对象字段生成，并且用户提交的数据能进入数据库。

**关键改动**：
- 前端：`FormDesigner.tsx` / 低代码编辑器增加「字段面板」，从当前应用对象拖拽字段到画布。
- 前端：`FormDesigner.tsx` 保存字段绑定关系到页面配置（page config）。
- 前端/后端：`PublicForm.tsx` 或 `FormRenderer` 根据页面配置渲染真实表单组件。
- 后端：`/api/apps/:slug/pages/:pageId/submit` 或 `/ontology/objects/:id/instances` 接收提交，写入 `ontology_instances` 表。
- 后端：增加表单提交校验（必填、唯一、类型）。

**关键文件**：
- `metaplatform-frontend/src/pages/apps/FormDesigner.tsx`
- `metaplatform-frontend/src/pages/apps/PublicForm.tsx`
- `metaplatform-frontend/src/pages/apps/editors/FormLowCodeEditor.tsx`
- `metaplatform-api/src/routes/app-forms.js`
- `metaplatform-api/src/routes/ontology.js`（实例 CRUD 已存在，需接收入口）

**验收标准**：
- 创建一个表单页面，绑定对象字段后，发布应用。
- 通过公开链接打开表单，填写后提交。
- 提交成功后，`ontology_instances` 表中新增一条记录。
- 提交失败时返回明确的中文校验提示。

**阻塞风险**：中。需要确定表单配置存储格式和渲染器设计。

**对应 v1.0.x 规划**：v1.0.1 US-201「表单编辑器」+ US-202「表单提交与校验」。

---

## Phase 3：列表页面查询、排序、过滤、导出

**目标**：让列表页能展示对象实例，并支持基础数据操作。

**关键改动**：
- 前端：`ListPageEditor.tsx` 增加列配置：选择对象字段作为列表列。
- 前端：新增通用 `ListRenderer.tsx`，支持分页、排序、关键字搜索、列过滤。
- 前端：列表页增加「导出 CSV」按钮。
- 后端：`/ontology/objects/:id/instances` 增加分页、排序、过滤参数。
- 后端：CSV 导出接口（流式或一次性）。

**关键文件**：
- `metaplatform-frontend/src/pages/apps/editors/ListPageEditor.tsx`
- `metaplatform-frontend/src/components/ListRenderer.tsx`（新建）
- `metaplatform-api/src/routes/ontology.js`（实例列表参数增强）
- `metaplatform-api/src/routes/app-reports.js` 或新建导出路由

**验收标准**：
- 创建一个列表页面，绑定对象后展示该对象的实例数据。
- 分页、排序、搜索、过滤均可用。
- 点击「导出 CSV」下载包含当前筛选结果的文件。

**阻塞风险**：低。依赖 Phase 2 产生的实例数据。

**对应 v1.0.x 规划**：v1.0.1 US-203「列表页」+ v1.0.2「应用+列表+模型」。

---

## Phase 4：流程运行时 + 待办中心 + 流程实例详情

**目标**：让流程设计器画出的图能真正跑起来。

**关键改动**：
- 前端：`ProcessDesignerV2.tsx` 增加「发布流程」按钮，把 BPMN XML 保存并部署到 Flowable。
- 后端：集成 Flowable 或自研简单状态机，提供 `/api/processes/:id/start`、`/api/tasks/:id/complete`、`/api/tasks/todo`。
- 前端：新建「待办中心」页面（或在应用详情新增 Tab），展示当前用户的待办任务。
- 前端：流程实例详情页，展示审批历史时间线。
- 前端：User Task 的办理人解析支持固定用户、角色变量。

**关键文件**：
- `metaplatform-frontend/src/components/flow-designer/ProcessDesignerV2.tsx`
- `metaplatform-frontend/src/pages/apps/Workflows.tsx`
- `metaplatform-frontend/src/pages/TodoCenter.tsx`（新建）
- `metaplatform-frontend/src/pages/ProcessInstanceDetail.tsx`（新建）
- `metaplatform-api/src/routes/processes.js`
- `metaplatform-api/src/routes/todos.js`
- `metaplatform-api/src/routes/flowable.js`

**验收标准**：
- 创建一个 2 节点审批流程（开始 → 用户任务 → 结束）。
- 通过表单提交触发流程启动。
- 办理人在 TodoCenter 看到待办，点击后审批通过/驳回。
- 流程实例详情页展示完整流转记录。

**阻塞风险**：高。需要确认当前 Flowable 集成程度和 BPMN XML 生成是否正确。

**对应 v1.0.x 规划**：v1.0.1 US-301/US-302「流程编辑与审批闭环」+ v1.0.3「流程闭环」。

---

## Phase 5：应用发布、多环境、版本回滚

**目标**：让应用能真正发布到不同环境，并支持回滚。

**关键改动**：
- 前端：`AppPublish.tsx` 接入真实发布 API，显示版本状态、发布时间、发布人。
- 后端：`/api/apps/:id/publish` 把应用配置、页面、流程、对象模型打包成快照。
- 后端：运行时在 `/app/:slug` 下按快照提供表单/列表/流程服务。
- 后端：多环境概念（开发/测试/生产），支持灰度百分比/按租户。
- 前端：版本对比 UI；一键回滚到上一版本。

**关键文件**：
- `metaplatform-frontend/src/pages/apps/AppPublish.tsx`
- `metaplatform-frontend/src/pages/apps/AppOverview.tsx`（版本/回滚）
- `metaplatform-api/src/routes/apps.js`（publish / unpublish / versions）
- `metaplatform-api/src/services/publish-snapshot.js`
- `metaplatform-api/src/services/runtime-orchestrator.js`

**验收标准**：
- 在应用详情点击发布，生成新版本。
- 通过 `/app/:slug` 访问时，看到的是已发布版本的页面和数据。
- 修改页面后重新发布，旧版本仍可回滚。
- 灰度发布对指定租户生效。

**阻塞风险**：高。涉及容器/运行时/反向代理，当前多为 stub。

**对应 v1.0.x 规划**：v1.0.6「发布+部署」+ 架构文档中发布 Tab 14 项功能。

---

## 推荐推进顺序与节奏

| Phase | 建议时长 | 优先级 | 理由 |
|---|---|---|---|
| Phase 1 字段管理 | 0.5-1 天 | P0 | 后续表单/列表/流程都依赖它 |
| Phase 2 表单绑定与提交 | 1-2 天 | P0 | 产生数据，让主链路开始流动 |
| Phase 3 列表查询导出 | 1 天 | P0 | 数据可查看，形成完整读写 |
| Phase 4 流程运行时 | 2-3 天 | P0 | 应用中心核心价值：审批 |
| Phase 5 发布与环境 | 2-3 天 | P1 | Demo 可用后即可推进 |

**最小可用闭环**：完成 Phase 1-4 后，即可对外演示「建对象 → 画表单 → 填数据 → 触发审批 → 待办处理」。

---

## 决策点

1. **是否先只做 Phase 1-4，把 Phase 5 放到下一个迭代？**
   - 推荐：先让主链路跑通，再补发布能力。
2. **Phase 2 表单渲染是否使用现有 `PublicForm.tsx` 还是新建 `FormRenderer`？**
   - 建议复用 `PublicForm.tsx`，它是表单提交入口。
3. **Phase 4 流程引擎用 Flowable 还是简化状态机？**
   - 若 Flowable 已配置好，优先用 Flowable；否则先用简化状态机实现 2 节点审批，快速闭环。

---

## 下一步

请确认：
- **A**：直接开始执行 Phase 1（字段管理）。
- **B**：跳到某个 Phase 先处理（请告诉我哪个）。
- **C**：针对 Phase 4 或 Phase 5 先做技术预研（流程引擎/发布运行时）。
