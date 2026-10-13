# 首页与本体组件渲染修复

状态：本地修复和评审完成；CI、部署及线上验收待登记。

用户于 2026-10-13 根据线上 UI 检查报告授权修复现有页面。沿用 ADR-0069 的现行导航、Semi 与平台令牌；不改变本体定义、权限、发布或同步契约。

修复范围：对象类型领域树与表格在窄屏的尺寸和滚动；首页引导与草稿表单的控件呈现；首页汇总字段适配、演示统计/动态/员工/待办标识及一致的待办计数；历史导入加载态与批次标签；中文状态、业务入口和日期；取消登录页历史密码提示及预填。

验证先复现接口字段不匹配、错误审批数量和登录错误，再修复。布局使用隔离前端、浏览器及固定只读测试响应，在 390、768、1024、1440px 验证可见控件、表格滚动与实际内容尺寸。固定响应只用于组件回归，不代替真实后端或业务验收。

保留云端数据和现存本地服务。本轮不执行数据库清理或修改本体实例。正式类型检查和构建使用 Node 22、前端锁文件。测试、CI、线上部署结果分别补登；当前记录不代表修复已上线。

## 本地证据

- 基线 `74e481ec63d55d3dea83b3ef4c7b45a496020238`；分支 `codex/ui-rendering-repair-20261013`。
- Node 22.23.3、pnpm 11.15.1；`pnpm install --frozen-lockfile --ignore-scripts` 完成。`PUPPETEER_SKIP_DOWNLOAD=true pnpm rebuild puppeteer esbuild` 完成，浏览器使用已有 Playwright Chromium。未修改锁文件。
- `pnpm --filter @mate/web test:unit src/api/dashboard/workbench.test.ts src/pages/dashboard src/pages/auth/SharedLoginPage.test.tsx src/pages/ontology/overview/OverviewPage.test.tsx src/pages/ontology/model/from-data src/pages/ontology/model/validation src/pages/ontology/governance/publication-workflow.test.tsx`：23 文件，197 项通过，0 跳过。
- `pnpm --filter @mate/web typecheck`、`pnpm --filter @mate/web build` 通过。构建保留原有大于 500kB 分块提示，未调整阈值。
- `pnpm exec playwright test --config playwright.ui-repair.config.ts`：9 项通过、0 跳过、0 失败。隔离端口 9371，固定 GET 响应，禁止业务写入；覆盖四档表格、手机引导、手机/桌面草稿控件、汇总错误及登录初始态。报告与截图保存到 `tests/e2e/.artifacts/ui-repair`，CI 上传同名证据。
- 新回归先复现字段映射、历史批次标签、401 中文提示、手机表格与引导尺寸、错误汇总仍显示空卡。评审补充复现演示队列被称作账号审批、同一任务重复提交；修复后通过，并覆盖乱序读取。CI 截图复核发现搜索图标压住占位文字，补充四档内边距断言后复现并修复。
- 独立代码复核已修正两项发现，最终无剩余 P1/P2；`git diff --check` 与 operations audit 完成。operations audit 的历史日期生成物未纳入提交。

## 数据与验收边界

`dashboard.py` 的摘要和待办仍是演示提供者；`/todos` 未按用户绑定。首页统计、动态、员工、待办明确显示演示来源，待办数量取同一列表响应，成功操作后重新读取；本轮不将其宣称为真实账号 KPI。真实业务引导继续核验既有实际产物。

本轮没有后端、数据库、迁移、权限或 API 契约修改。上述组件和布局测试不替代生产数据闭环或正式数据库验收；PR 和主干的既有完整门禁继续执行。
