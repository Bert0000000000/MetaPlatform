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
- 前端生产构建 `pnpm --filter @mate/web build` 通过；使用独立 `vite preview`
  生产静态站点（端口 `9251`）运行 Playwright，保存、发布、运行、刷新持久化和
  两标签页陈旧保存恢复 `2 passed`。该验证不依赖开发服务器。

## 未闭环项

- Temporal 持久运行、Outbox 事务和 staging/prod 发布演练仍未完成。

## 结论

该记录确认本地实现和主要系统旅程已通过；真实生产门禁仍未闭环，保持 `[~]`，不
得宣称 action-orchestration v1.7 已 GA Accepted。

## 2026-09-09 条件核销补充（最终冲刺批次一）——保持 [~]

本批未新增 v1.7 专项证据。原未闭环项（Temporal 持久运行 / Outbox 事务 /
staging-prod 发布演练）中：
- Temporal 平面已修复自愈探针崩溃循环（temporalio 1.32 签名兼容），
  worker 稳定运行，为持久运行核销铺平；
- Temporal 持久运行 + Outbox 事务核销依赖 mate-app-wfe 服务纳入运行栈
  （当前栈未含），随最终冲刺批次三/四的 staging 演练与端到端 demo 一并
  核销。
状态：`[~]`（条件不变）。
