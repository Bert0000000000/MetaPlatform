# 业务语义合并审核：本地验收记录（2026-10-13）

依据：[ADR-0083](../active/decisions/ADR-0083-data-driven-modeling-phase1.md) 的 2026-10-13 补充决定；[实施计划](../superpowers/plans/2026-10-13-modeling-semantic-review.md)。用户批准合并业务语义审核，要求不影响其他样式。

## 本轮行为

- 对象与纳入范围的属性、关系、映射在列表和详情展示相关业务语义。确认所属项同时确认对应语义；批量审核弹窗展示将确认的语义。
- “一次处理并确认”返回本次发布范围内的语义并在确认窗口展示；服务端只确认最终范围内的定义，暂缓项保留原状态。方案哈希仍绑定完整草稿、来源及修订。
- 顶部增加未确认语义数量；原先折叠的语义入口常驻显示。修改候选或语义撤销受影响审核，不自动批准修改。
- 校验问题可直接打开现有详情抽屉，先保存再校验，成功后仍留在第三步。
- 没有更改 CSS/SCSS、主题令牌、共享 SheetDetail 实现或锁文件。沿用现有布局、卡片、表格、按钮、抽屉与媒体查询。屏幕边界检查等待抽屉动画结束。

## 本地验证

运行时：Node 22.22.1、Python 3.12.13。沿用当前工作树已有 node_modules 和后端 .venv；未新增依赖。pnpm 11.15.1 的执行前自动安装因现有 allowBuilds 配置拒绝而失败；其自动写入配置已撤销。验证随后直接调用当前工作区已安装的 Node 工具，不能据此宣称本轮完成 frozen-lockfile 安装。Black 未安装；Python 文件执行 Ruff 检查与格式检查均通过。

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| 当前建模页及 SplitPane 单元回归 | 16 文件、117 项通过 | [日志](../../.ci/semantic-unit.log) |
| 前端 TypeScript | `node node_modules/typescript/bin/tsc -b --noEmit` 退出 0 | 当前源码执行 |
| Vite 独立输出构建 | 退出 0；保留已有大 chunk 警告 | [日志](../../.ci/semantic-build.log) |
| 建模方案、范围、真实数据库集成 | 56 项通过、零跳过 | [日志](../../.ci/semantic-backend.log)、[JUnit](../../.ci/semantic-backend.xml) |
| 必需 PostgreSQL 六组门禁 | 123 项实际执行、零跳过、六组齐全 | [重跑日志](../../.ci/semantic-ont-postgres-rerun.log)、[JUnit](../../.ci/semantic-ont-postgres-rerun.xml) |
| 浏览器 UI 回归 | 1 项通过；浅色/深色、1440/768/390px；批量确认、原地修改、保存后校验及动画后屏幕边界 | [配置](../../metaplatform-frontend/playwright.semantic-review.config.ts)、[JUnit](../../.ci/semantic-browser.xml)、[截图目录](../../.ci/semantic-browser-artifacts) |
| OpenAPI | YAML 可解析，新增 semantics 引用的 schema 存在 | `ontPrepareModelingCompletion` 返回新增可选字段；未更改请求或写入门禁 |
| 差异卫生 | `git diff --check` 通过；CSS/SCSS/锁文件无差异 | 当前工作树 |

数据库：本轮新建 Docker PostgreSQL 16 容器 `mp-semantic-review-20261013-1430`，独立数据库 `semantic_review`，非特权角色 `semantic_reviewer`（NOSUPERUSER、NOBYPASSRLS），仅绑定 localhost 临时端口。建模集成与必需门禁顺序执行，未使用现有业务数据库。六组门禁首轮 122 通过、1 项遇 Windows TCP `Address already in use`；完整重跑 123 项通过，首轮证据保留于 `.ci/semantic-ont-postgres.log`，不将首轮记为通过。

浏览器使用本轮独立预览端口 19358，API 全部拦截为隔离模拟数据，无真实发布或同步操作。运行：从前端工作区执行 `node node_modules/@playwright/test/cli.js test --config playwright.semantic-review.config.ts`，默认连接独立预览，可用 E2E_BASE_URL 指定其他独立服务。

## 证据边界

以上为本地验证，不代表 PR/主干 CI、部署或用户业务验收。浏览器 UI 回归不是真实认证的核心发布/同步闭环，也未执行迁移浏览器套件。新增和修改的业务路径有单元测试、真实数据库建模集成及六组数据库门禁支持。已有 docker-compose.override.yml 修改、已有 outputs/.ci/构建目录和所有现存工作树均保留；仅清理本轮命名容器和本轮启动的预览进程。
