# 逆向发现本体：本地验证记录

日期：2026-10-12；目录 D:/code/MetaPlatform，分支 codex/data-modeling-phase1。
依据：[ADR-0083](../active/decisions/ADR-0083-data-driven-modeling-phase1.md) 最新审批/发布分离决定。

## 最终行为

候选批量审批与正式本体发布分离：审批只检查候选结构、业务依据及暂缓范围，不读取已有本体来决定审批能否通过。普通 validate 默认不生成发布计划。发布前独立窗口选择新建、复用或增加属性，带出完整 RID 和建议属性对应；显式 preparePublication=true 才检查占用标识、映射与原生基线。已有标识不能重复新建，但不阻断候选审批。最终发布必须通过当前发布校验并明确确认，部分发布目标及范围仍锁定。

候选图谱直接复用模型工作台的 OntologySchemaGraph，统一布局、搜索、缩放、拖动、局部关联与关系选择，保留候选详情、继承线；按来源隔离布局保存。逆向页面通用表单 CSS 排除图谱控件，避免搜索图标/输入框上下堆叠和双层边框。

保留此前进度恢复、业务问题隐藏、生成质量/AI 语义审查界面隐藏及已有证据展示。演示本体保留，未确认/发布用户真实候选。

## 当前验证

| 范围 | 实际结果 |
| --- | --- |
| 前端 from-data Vitest | 15 文件、72 项通过，包含审批/发布拆分及共享图谱交互 |
| TypeScript | 通过 |
| 生产构建 | 通过；样式修正后再构建通过，保留既有 chunk 大小警告 |
| 建模单元回归 | 208 项通过 |
| 建模 PostgreSQL 集成 | 35 项通过，零跳过，包括同名占用不阻断审批、发布预检阻止重复新建 |
| 必需 PostgreSQL 六组门禁 | 123 项执行通过、零跳过、六组覆盖 |
| Chromium + 独立真实后端/数据库 | 同名对象下批量审批通过→发布窗口拦截重复新建→复用完整 RID→显式发布成功，审批保留 |
| Chromium 共享图谱 | 模型工作台/候选图谱同一渲染器，搜索、缩放、局部关联与详情通过；零写请求 |
| Chromium 明暗主题搜索框 | 图标与输入框单行对齐、内框无边框且背景透明、高度不超过 40px、无溢出；零写请求 |

数据库仅使用独立 PostgreSQL 16 容器 metaplatform-discovery-20261012，端口 19432，非特权 mate_ont_test。浏览器使用独立后端 19407 与生产预览 19350，通过浏览器路由转发连接真实接口；身份由测试中间件注入，不覆盖真实 IAM/网关鉴权。未记为完整 R1 浏览器/业务验收。

本地生成证据在 `.ci/review-separation-{modeling,pure,ont-postgres}.xml`、`.ci/review-separation-frontend.log`、`.ci/review-separation-build.log`、`.ci/review-separation-browser.png`、`.ci/discovery-shared-graph-browser.png`、`.ci/discovery-search-style-{light,dark}.png` 及 `.ci/discovery-search-style-build.log`。脚本位于本地 `.cache/`，依赖使用已有环境，未改锁文件。

mate-tech-ont 已重启并 healthy；已通过当前制造资料 completion-plan 只读预览确认 canApply=true、remaining=[]，未修改来源/审批/正式本体。前端 9250 使用源码热更新。本记录为本地研发证据；完整 PR/主干 CI、部署及业务验收未执行。


## 后续修正：发布窗口直接确认

取消长表格末尾的强制勾选；点击确认发布时自动保存并预检，通过才发布。错误/阻断固定显示于按钮旁。已有英文编码/名称属性可通过稳定标识准确对应，未覆盖显式人工映射。普通选择、可选校验和取消窗口均不自动发布。

最新验证：from-data 15 文件 75 项通过；类型检查通过；production build 通过。Chromium 使用独立真实后端及 PostgreSQL，验证重复新建仍被阻断、配置复用后单次显式确认依次触发 validate/publish 并成功、审批保持。证据 `.ci/publication-direct-{frontend.log,build.log,browser.png}`，本地脚本为前端 `.cache/publication-direct-browser.cjs`。本轮未发布用户真实候选。
