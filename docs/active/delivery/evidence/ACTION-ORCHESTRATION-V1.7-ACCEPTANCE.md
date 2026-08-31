# Action Orchestration v1.7 验收记录

> 状态：`[~] 条件验收记录`（不是 v1.0 GA Accepted）
> 代码基线：`6d81abba`
> 记录日期：2026-08-27

## 范围

本批覆盖 FlowGram 节点类型动态 schema、NodeInspector 字段展示、删除节点时
关联线清理，以及 v1.7 Playwright 验收用例。

## 已验证

- 前端 TypeScript/Vite 生产构建已通过。
- v1.6 `drag-prod.spec.ts` 历史链路已通过并作为前置证据保留。
- v1.7 用例已纳入仓库，覆盖节点拖拽、属性面板和删除节点操作。

## 2026-08-31 本地 Docker 验证补充

- WFE 版本化 Plan 测试 `25 passed`；本地 Docker 已验证 Keycloak、Gateway 与 WFE 的
  tenant-bound 保存、发布、运行和状态回读。
- Playwright 刷新持久化、保存/发布/运行和两标签页陈旧保存恢复 `2 passed`；前端
  TypeScript typecheck 通过。

## 未闭环项

- 当前 Playwright 运行于本地 Vite 验收服务器，尚未在生产构建静态站点完成同等系统验收。
- Temporal 持久运行、Outbox 事务和 staging/prod 发布演练仍未完成。

## 结论

该记录确认本地实现和主要系统旅程已通过；真实生产门禁仍未闭环，保持 `[~]`，不
得宣称 action-orchestration v1.7 已 GA Accepted。
