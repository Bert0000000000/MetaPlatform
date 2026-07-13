# v1.0.2 Sprint 计划

> **版本**：v1.0.2「Link+Export」
> **配套文档**：[`01-user-stories.md`](./01-user-stories.md) · [`03-test-cases.md`](./03-test-cases.md) · [`07-migration-from-v1.0.1.md`](./07-migration-from-v1.0.1.md)
> **核心交付**：5 个 Sprint，5 周交付可发布的 v1.0.2

---

## 〇、Sprint 全景图

```
┌────────┬──────────────────────────────┬─────────┬───────────────┬────────────────────┐
│ Sprint │ 名称                         │ 周期    │ 负责人角色    │ Demo 节点          │
├────────┼──────────────────────────────┼─────────┼───────────────┼────────────────────┤
│  S1    │ 关联字段 + 高级列表          │  2 周   │ 后端 1 + 前端 2│ L1+L2 跑通          │
│  S2    │ 导入导出 (CSV + 模板)        │  1 周   │ 后端 1 + 前端 1│ CSV 导入导出跑通     │
│  S3    │ 行级权限 + 多列布局          │  1 周   │ 后端 1 + 前端 1│ 权限隔离 + 栅格生效  │
│  S4    │ 性能优化 + E2E 联调          │  0.5 周 │ 测试 1 + 全员 │ e2e 全绿 + 性能达标 │
│  S5    │ 评审 + 文档 + Release        │  0.5 周 │ PM + 全员     │ 评审通过            │
└────────┴──────────────────────────────┴─────────┴───────────────┴────────────────────┘
                                                  总周期约 5 周
```

---

## 一、Sprint 1（Week 1 ~ Week 2）：关联字段 + 高级列表

### 1.1 目标

- **L1 关联对象**端到端可用：业务能添加 lookup 字段、表单/列表可正常渲染
- **L2 高级列表**端到端可用：搜索/排序/过滤/列控制/导出 CSV

### 1.2 待办列表

#### 后端

| 任务 | 文件 | 优先级 | 估时 | 状态 |
|------|------|--------|------|------|
| B1.1 AppObjectService.listObjects 加分页参数 | `AppObjectService.java` | P0 | 0.5d | ☑ (24 单测 + 14 e2e 全绿) |
| B1.2 AppObject FieldRequest 支持 lookup 配置 | `AppObjectService.java` | P0 | 1d | ☑ (27 单测 + 14 e2e 全绿) |
| B1.3 lookup 字段 DDL 生成 BIGINT 列 + FK 索引 | `AppObjectFieldService.java` | P0 | 1d | ☑ (21 单测 + 8 e2e 全绿) |
| B1.4 AppObjectInstanceService.listInstances 支持分页 + 排序 + 过滤 | `AppObjectInstanceService.java` | P0 | 2d | ☑ (44 单测 + 18 e2e 全绿) |
| B1.5 GET /objects/{id}/instances/{id} 支持 lookup 字段连表查询 | `AppObjectInstanceService.java` | P0 | 1d | ☑ (11 单测 + 9 e2e 全绿) |
| B1.6 列表 API 返回 totalCount + pageSize + pageNumber | `AppObjectController.java` | P0 | 0.5d | ☑ (B1.4 已隐式覆盖; B1.7 P8 验证) |
| B1.7 e2e 测试: lookup 字段 CRUD + 列表查询 | `tests/e2e-v1.0.2/` | P0 | 0.5d | ☑ (B1.7 综合 41 项全绿) |

#### 前端

| 任务 | 文件 | 优先级 | 估时 | 状态 |
|------|------|--------|------|------|
| F1.1 ObjectFieldPanel 加 "关联" 字段类型 + 选择目标对象/字段 | `ObjectFieldPanel.tsx` | P0 | 1d | ☑ (21 单测 + 10 e2e 全绿) |
| F1.2 ObjectFieldPanel 显示 "不可修改" 时排除 lookup (因 schema 变更风险高) | `ObjectFieldPanel.tsx` | P1 | 0.5d | ☑ (编辑 lookup 时显示 Schema 变更风险提示卡; shouldShowFieldTypeHelper/shouldShowLookupWarning 纯函数 + 13 个单测 + tsc 0 errors + Vite HMR 通过) |
| F1.3 FormLowCodeEditor lookup 字段拖入时显示目标对象选择器 | `FormLowCodeEditor.tsx` | P0 | 1d | ☑ (16 单测 + 0 type errors) |
| F1.4 PublicForm lookup 渲染为下拉框 | `PublicForm.tsx` | P0 | 1d | ☑ (后端 LookupFieldExtractor 17 单测 + 前端 LookupDropdown 16 单测 + 13 e2e 全绿) |
| F1.4b Formily x-reactions 联动显隐 | `schemaAdapter.ts` + `fields.tsx` | P0 | 1d | ☑ (16 单测 + 14 e2e + 文档 formily-reactions.md) |
| F1.4c **PublicForm 全量切换为 Formily 2** (旧自研 JSX 删除) | `PublicForm.tsx` | P0 | 0.5d | ☑ (V2 → V1 覆盖重命名; 0 errors; Vite build 6.35s; 39 e2e 全过; 文档 publicform-formily-fullcutover.md) |
| F1.5 ListPageEditor 顶部搜索框 + 实时过滤 | `ListPageEditor.tsx` | P0 | 1d | ☑ (合并到 F1.7 过滤器面板) |
| F1.6 ListPageEditor 列头点击排序 + 排序箭头 | `ListPageEditor.tsx` | P0 | 1d | ☑ (none→asc→desc→none 三态 toggle + ArrowUpDown/Up/Down 图标) |
| F1.7 ListPageEditor 过滤器 UI (**9** 种操作符) | `ListPageEditor.tsx` + `FilterRow.tsx` + `filterSerializer.ts` | P0 | 2d | ☑ (eq/neq/gt/gte/lt/lte/contains/empty/in + 37 单测 + Formily connect + x-reactions 联动) |
| F1.8 ListPageEditor 列设置面板 (显示/隐藏/排序/拖拽) | `ListPageEditor.tsx` | P0 | 1d | ☑ (显示/隐藏 + 列名编辑; 拖拽 v1.0.3) |
| F1.9 列表页导出按钮 + CSV 序列化 (UTF-8 BOM) | `FormDataController` | P0 | 1d | ☑ (B1.3 已就位, F1.9 复用) |
| F1.10 URL 同步过滤器状态 | `ListPageEditor.tsx` + `filterSerializer.ts` | P0 | 0.5d | ☑ (filter_field / sort / page / size 双向; replace history) |

### 1.3 验收节点（Demo）

- 业务能创建"客户"和"订单"对象 → 在"订单"里添加 lookup "客户"字段
- 订单表单渲染 lookup 为下拉框，列出客户名称
- 订单列表页能搜索、排序、过滤、隐藏列、导出 CSV

### 1.4 风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| lookup 字段 DDL ALTER 失败（已存在数据） | 高 | Sprint 1 第 1 天做技术 spike |
| 列表分页 + 排序 + 过滤 性能不足 | 中 | 用 DB 索引 + 后端分页查询 |
| CSV 导出大数据 (>10000 行) 浏览器卡死 | 中 | 后端流式生成，前端 fetch + download |

---

## 二、Sprint 2（Week 3）：导入导出

### 2.1 目标

- **CSV 导入**完整可用：模板下载、字段映射、dry-run 校验、错误报告
- **应用模板导入导出**端到端可用：JSON 模板打包、版本兼容、冲突策略

### 2.2 待办列表

#### 后端

| 任务 | 文件 | 优先级 | 估时 | 状态 |
|------|------|--------|------|------|
| B2.1 CSV 模板生成 endpoint | `AppObjectController.java` | P0 | 0.5d | ☐ |
| B2.2 CSV 解析 endpoint (multipart/form-data) | `AppObjectController.java` | P0 | 1d | ☐ |
| B2.3 Dry-run 校验模式 (不写库, 仅返回错误) | `CsvImportService.java` | P0 | 1d | ☐ |
| B2.4 事务性批量插入 + 行级错误隔离 | `CsvImportService.java` | P0 | 1d | ☐ |
| B2.5 错误报告 CSV 生成 | `CsvImportService.java` | P0 | 0.5d | ☐ |
| B2.6 应用模板导出 endpoint (GET /apps/{id}/template) | `AppTemplateService.java` | P0 | 1d | ☐ |
| B2.7 应用模板导入 endpoint (POST /apps/import) | `AppTemplateService.java` | P0 | 1.5d | ☐ |
| B2.8 模板版本兼容性检查 | `AppTemplateService.java` | P0 | 0.5d | ☐ |

#### 前端

| 任务 | 文件 | 优先级 | 估时 | 状态 |
|------|------|--------|------|------|
| F2.1 CSV 模板下载按钮 | `ListPageEditor.tsx` | P0 | 0.5d | ☐ |
| F2.2 CSV 文件上传 + 字段映射对话框 | `CsvImportDialog.tsx` | P0 | 1.5d | ☐ |
| F2.3 导入进度条 + 节流更新 | `CsvImportDialog.tsx` | P0 | 1d | ☐ |
| F2.4 导入结果摘要 + 错误报告下载 | `CsvImportDialog.tsx` | P0 | 0.5d | ☐ |
| F2.5 应用模板导出按钮 | `AppOverview.tsx` | P0 | 0.5d | ☐ |
| F2.6 应用模板导入对话框 (含预览 + 冲突策略选择) | `AppImportDialog.tsx` | P0 | 1.5d | ☐ |

### 2.3 验收节点（Demo）

- 下载订单模板 → 填 500 行 → 上传 → 进度条 → 导入 498/500 → 失败行下载报告
- 把"CRM"应用导出 JSON → 在另一个环境导入 → 应用结构完整恢复

### 2.4 风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| CSV 解析对 Excel 生成的 CSV 不兼容 | 中 | 优先用 UTF-8 BOM, 文档说明格式 |
| 应用模板包含 BPMN XML 序列化复杂 | 中 | 用 Jackson + @JsonInclude.NON_NULL |
| 模板版本兼容性边界 case 多 | 低 | 第一版只支持 v1.0.1 ↔ v1.0.2 |

---

## 三、Sprint 3（Week 4）：行级权限 + 多列布局

### 3.1 目标

- **行级权限**4 种策略可配置、Service 层强制应用
- **多列布局表单**支持 1/2/3/4 列、响应式降级
- **批量操作**最简实现（批量删除 + 单字段批量赋值）

### 3.2 待办列表

#### 后端

| 任务 | 文件 | 优先级 | 估时 | 状态 |
|------|------|--------|------|------|
| B3.1 行级权限策略数据模型 + 配置 endpoint | `RowLevelAuthService.java` | P0 | 1d | ☐ |
| B3.2 4 种内置策略: own/dept/custom/all | `RowLevelAuthService.java` | P0 | 1d | ☐ |
| B3.3 自定义 DSL 解析器 (支持 =, !=, >, <, AND, OR, ${currentUser.x}) | `RowLevelAuthService.java` | P0 | 1.5d | ☐ |
| B3.4 Service 层强制过滤 (list/get/update/delete 5 个端点) | `AppObjectInstanceService.java` | P0 | 1d | ☐ |
| B3.5 批量删除 endpoint (POST /instances/batch-delete) | `AppObjectInstanceService.java` | P0 | 0.5d | ☐ |
| B3.6 批量更新 endpoint (POST /instances/batch-update) | `AppObjectInstanceService.java` | P1 | 0.5d | ☐ |
| B3.7 权限配置写入 audit log | `AuditLogService.java` | P1 | 0.5d | ☐ |

#### 前端

| 任务 | 文件 | 优先级 | 估时 | 状态 |
|------|------|--------|------|------|
| F3.1 行级权限配置页 (策略选择 + DSL 编辑器) | `RowLevelAuthEditor.tsx` | P0 | 1.5d | ☐ |
| F3.2 列表页 "批量操作" 工具栏 (选中行 → 批量删除) | `ListPageEditor.tsx` | P0 | 1d | ☐ |
| F3.3 表单编辑器工具栏 "布局" 选项 (1/2/3/4 列) | `FormLowCodeEditor.tsx` | P0 | 1d | ☐ |
| F3.4 字段 span 属性 (跨列数) | `FormLowCodeEditor.tsx` | P0 | 0.5d | ☐ |
| F3.5 PublicForm 渲染多列响应式布局 | `PublicForm.tsx` | P0 | 1d | ☐ |

### 3.3 验收节点（Demo）

- 配置"销售员只能看本部门订单"→ 销售员登录看不到其他部门
- 表单编辑器切换 2 列布局 → 预览页 1920px 显示 2 列、768px 显示 1 列

### 3.4 风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| DSL 注入风险（恶意表达式） | 高 | 用白名单变量 `${currentUser.x}`, 不允许函数调用 |
| 行级权限与其它过滤冲突 | 中 | 权限过滤在最内层，其它过滤在外层 AND |
| 多列布局拖拽 UX 复杂 | 中 | 第一版用 grid CSS, 不做复杂拖拽 |

---

## 四、Sprint 4（Week 5 前半）：性能优化 + E2E 联调

### 4.1 目标

- 性能优化 3 项落地
- E2E 联调全绿

### 4.2 待办列表

| 任务 | 文件 | 优先级 | 估时 | 状态 |
|------|------|--------|------|------|
| B4.1 AppObjectFieldService.listFields 加 Caffeine 缓存 | `AppObjectFieldService.java` | P0 | 0.5d | ☐ |
| B4.2 PublicForm GET /public/forms/{id} 加 ETag + 304 支持 | `PublicFormController.java` | P0 | 0.5d | ☐ |
| B4.3 DataCenter 实例查询加常见字段索引 (status, created_at) | Flyway/SQL | P0 | 0.5d | ☐ |
| F4.1 路由级 code splitting (AppOverview/TodoCenterPage lazy import) | `router.tsx` | P0 | 0.5d | ☐ |
| F4.2 DataModeling 列表虚拟化 (react-window) | `DataModeling.tsx` | P1 | 1d | ☐ |
| F4.3 E2E 测试: 全量场景覆盖 | `tests/e2e-v1.0.2/` | P0 | 1d | ☐ |
| F4.4 性能基准测试: 1000 行首次渲染 < 1.5s | `tests/perf/` | P0 | 0.5d | ☐ |

### 4.3 验收节点

- Lighthouse 性能分数 >= 80
- E2E 全部用例通过
- 1000 行数据列表渲染 < 1.5s

---

## 五、Sprint 5（Week 5 后半）：评审 + 文档 + Release

### 5.1 任务清单

| 任务 | 负责人 | 状态 |
|------|--------|------|
| 5.1 写 [`04-test-report-template.md`](./04-test-report-template.md) 实际内容 | 测试 | ☐ |
| 5.2 评审会 (产品 + 架构师) | PM | ☐ |
| 5.3 CHANGELOG 更新 | PM | ☐ |
| 5.4 Git: 合并 release/v1.0.2 → main, 打 tag v1.0.2 | Tech Lead | ☐ |
| 5.5 GitHub Release + Release Notes | PM | ☐ |
| 5.6 通知下游（销售、CS）v1.0.2 已发布 | PM | ☐ |

### 5.2 Release Gate（不达标不发版）

- [ ] 所有 P0 AC 通过
- [ ] E2E 全绿
- [ ] 性能基准达标
- [ ] 无 P0/P1 已知 bug
- [ ] 向后兼容测试通过（v1.0.1 数据无破坏）

---

## 六、关键路径与依赖

```
Sprint 1 ──→ Sprint 2 ──→ Sprint 3 ──→ Sprint 4 ──→ Sprint 5
   │            │            │
   ▼            ▼            ▼
 lookup      CSV 导入    行级权限
 字段        模板导入     DSL 解析
```

- **Sprint 1 必须先完成 lookup 字段**，否则 Sprint 2 CSV 导入中的 lookup 字段映射无法实现
- **Sprint 3 行级权限的 DSL 解析器** 可复用 Sprint 2 CSV 导入的错误处理模式

---

## 七、人员配置

| 角色 | 人数 | 主要工作 |
|------|------|---------|
| 后端 | 1-2 | AppObject/Instance/RowLevelAuth Service、Caffeine、ETag |
| 前端 | 2 | ObjectFieldPanel、FormLowCodeEditor、ListPageEditor、PublicForm |
| 测试 | 1 | E2E、性能基准 |
| PM | 0.5 | 评审、文档 |

---

## 八、变更说明（与 v1.0.1 Sprint 比较）

| 维度 | v1.0.1 | v1.0.2 |
|------|--------|--------|
| Sprint 数 | 6 (含 S0 脚手架) | 5 (复用 v1.0.1 基础设施) |
| 总周期 | 8 周 | 5 周 (复用加速) |
| Demo 数 | 3 (M1/M2/M3) | 4 (L1/L2/L3/L4) |
| 团队规模 | 5-7 人 | 4-6 人 |
| 性能优化 | 无 | 3 项 (缓存/ETag/分页) |
| 数据迁移 | 无 | 1 篇 [`07-migration-from-v1.0.1.md`](./07-migration-from-v1.0.1.md) |

---

## 九、Sprint 1 启动检查清单（明天就开始）

- [ ] release/v1.0.2 分支已创建
- [ ] 数据库有 v1.0.2 schema (向后兼容)
- [ ] ETag header 已在 v1.0.1 + AC-103.6 实现基础上可用
- [ ] `feature/lookup-field` 特性分支已创建
- [ ] Sprint 1 任务列表已在项目管理工具登记
- [ ] 团队周会已确认 Sprint 1 起止日期

详细 Git 流程见 [`06-git-branching-and-release.md`](./06-git-branching-and-release.md)。