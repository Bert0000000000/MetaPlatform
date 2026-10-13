# 本体原生控件呈现补充修复

2026-10-14 线上复核已确认 PR #154 的首页、列表、导入批次与草稿控件修复生效，部署版本为 `8509740910b8ef12243e85a3350ee18007ef3ce9`。继续打开模型编辑器时，发现未设置平台样式的原生按钮、选择框与说明框，以及手机底部操作按钮被压成多行。

沿用既有 Semi 令牌，给本体原生控件增加显式样式作用域，排除已有 class 的组件；普通 input 仅包含未设 type、text/search/email/url/tel/password/number，基础、禁用及焦点规则使用同一白名单，排除 checkbox/radio/file/hidden/range/color 等控件。使用低优先级 `:where`，保留上下文布局覆盖。模型编辑器说明框与操作栏采用可换行布局。不变更数据、权限、校验、草稿或发布逻辑。

先通过隔离浏览器复现控件高度、说明框尺寸和手机操作栏问题，再验证手机/桌面、浅色/深色及已有 Semi 按钮尺寸。只读 GET 固定响应属于呈现回归；既有真实建模/迁移/发布浏览器和数据库 CI 保留。

本记录在实现前建立；本地验证与独立评审完成，PR、主干 CI、部署与线上验收另行登记。当前已上线的前一批修复继续保留。

## 本地验证与评审

- Node 22.23.3、pnpm 11.15.1，沿用前一批锁定依赖与 Chromium，未修改锁文件或数据库。
- 新增编辑器浏览器回归先在原代码复现：390/1440px 的读取数据源按钮高度仅 23px，未满足平台 32px 控件尺寸。
- 修复后 `pnpm exec playwright test --config playwright.ui-repair.config.ts`：12 项通过，0 跳过/失败；覆盖既有四档列表、引导、草稿、登录和错误态，并新增手机/桌面编辑器、手机深色主题、说明框尺寸、五项底部动作可见尺寸与文本不折行、Semi 新建按钮仍为 32px。测试仅允许 GET 固定响应，未保存或发布生产本体。
- `pnpm --filter @mate/web test:unit src/api/dashboard/workbench.test.ts src/pages/dashboard src/pages/auth/SharedLoginPage.test.tsx src/pages/ontology/overview/OverviewPage.test.tsx src/pages/ontology/model/from-data src/pages/ontology/model/validation src/pages/ontology/governance/publication-workflow.test.tsx src/pages/ontology/components/ObjectTypeEditorV2Drawer.test.tsx src/pages/ontology/model/object-types/editor-continuation.test.tsx src/contexts/SettingsContext.test.tsx`：26 文件，229 项通过，0 跳过。
- 类型检查与生产构建通过；保留既有大于 500kB 分块提示。上述本地证据基于 `85097409`，提交前同步主干的关系图修复 `a9796736`；正式 CI 在最终提交重新验证。
- 独立只读复核已统一输入类型白名单，最终未发现剩余 P1/P2 或明显范围风险。`git diff --check` 通过，JSON fixture 通过 Prettier 3.1.0 格式化。
- 相关既有 operationId：`ontGetV2ObjectType`、`ontSaveV2SchemaWip`、`ontApplyV2SchemaWip`；仅呈现与 DOM 容器修改，提交处理和 API 契约保持原状。

截图及 JSON 报告在 `metaplatform-frontend/tests/e2e/.artifacts/ui-repair`。完整真实建模、迁移、发布与 PostgreSQL 门禁继续执行；固定响应呈现测试不替代真实业务验收。
