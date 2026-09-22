# ONTOLOGY-IA2-4 验收证据（对象与查询拆分）

> **批次**：IA2-4（ADR-0069 实施切片 5/8）
> **日期**：2026-09-22
> **分支**：`feat/ontology-ia2-3-data-mapping`（IA2-3 之上连续提交；worktree `.worktrees/ontology-ia2-3-data`）
> **决策**：ADR-0069；设计规格 `docs/active/specs/2026-09-18-ontology-ia-v2-design.md` §7.4

## 1. 改动摘要与文件清单

**做了什么**：对象详情从组件状态升格为**路由**（`/ontology/explore/objects/:rid` 段路由，
列表与详情同一条可选参数路由——打开/关闭/关系跳转不重挂列表）；页码进 URL；
关系跳转改走浏览器历史（trail 内存栈退役）；旧 `?id=` 深链 replace 迁移到段路由；
ADR-0065 上下文的 openRecordIds 从段路由提取；AppsPage 容器删除。

**修改**：

| 文件 | 改动 |
| --- | --- |
| `explorer/ObjectExplorerPage.tsx` | `:rid` 段是「打开中的对象」唯一真相：openDetail/openRelated/goBack/closeDetail 全部 navigate；`?page=` 进 URL；jumpedRef（会话内跳转标记）驱动「返回」按钮走 `navigate(-1)`；「新标签页打开」产出段路由 URL |
| `routes/ontology.tsx` | `objects/:rid?` 可选段路由（列表/详情同组件不重挂） |
| `shell/OntologyDomainShell.tsx` | openRecordIds 从 `/objects/:rid` 段提取（旧 `?id=` 兜底兼容）——ADR-0065 S2 上下文随新路由形态对齐 |
| `explorer/explorer.css` | trail 面包屑 4 条死规则清除 |

**删除**：`apps/AppsPage.tsx`（容器使命结束，无引用后删）。`DashboardPage.tsx` 按设计规格
保留（归宿 AppHub 待确认，IA2-7 处置）。

## 2. 路由变化（本批增量）

| 路由 | 说明 |
| --- | --- |
| `/ontology/explore/objects/:rid` | 对象详情（列表页内 Sheet 呈现，URL 即分享地址；刷新/直达同一容器） |
| `?page=N` | 页码进 URL（class/q 已有） |
| 旧 `?id=` 深链 | 页面内 replace 到段路由（保留一个发布周期） |

## 3. 测试命令与真实结果（2026-09-22 实测）

| 命令 / 用例 | 结果 |
| --- | --- |
| `pnpm typecheck` / `pnpm build` | ✅ / ✅ 20.0s |
| `pnpm test:unit` | 65/66（唯一红 = 预存 ProposalConfirmDrawer） |
| `node scripts/check_classes.mjs` | ✅ |
| `ontology-ia-v2-object-flow.spec.ts`（新增） | **4/4 绿**（打开→URL 变段路由→刷新不丢→关闭回列表 / 关系跳转 URL 更新+浏览器返回 / 旧 ?id= 迁移 / 页码进 URL） |
| 回归簇 ui-p1a / nav / data-flow / context-navigate | 6/6 · 5/5 · 3/3 · 4/4 绿（对象浏览 Sheet 行为与 ADR-0065 上下文链路均兼容） |
| 全量 Playwright | **153 过 / 1 红 / 1 skip**（7.7m）。唯一红 = superai-routing「正式聊天页展示」——2.0 会话整合既有回归（task_322fbacf），非 IA v2 |

## 4. 浏览器验证

- object-flow 断言全走真实链路（真实类型/实例/around 数据，无 mock）：点击行为、
  URL 轮询、reload、goBack。

## 5. 已知边界与回滚

1. **排序未进 URL**：DataTablePro 的列排序是组件内部状态，受控化需改造共享组件
   （牵连 9 个使用方）——登记为后续独立任务（可挂在 DataTablePro 受控排序增强）。
2. **Analysis/Map 共享 ObjectSet 输入未统一**（设计规格允许首批保留现状）。
3. 关系跳转面包屑 UI（trail 标题）退役，由浏览器历史承担返回——「返回」按钮
   在本会话跳转过才显示；直接深链进入的对象用「复制 RID」。
4. 回滚：本批提交组独立可退（回退后恢复 ?id= 深链与内存 trail）。

## 6. 结论

IA2-4 准出达成：对象消费闭环在新路由下完整通过（列表→打开→关联跳转→浏览器返回→
执行动作链路组件原样保留）；URL 可分享、刷新不丢；容器（AppsPage）删除；
Dashboard 不在本体导航。
