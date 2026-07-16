# v1.0.1「Forge+Flow」 版本文档（入口）

> 本文档是 **v1.0.1「Forge+Flow」** 的总入口。
>
> **父级**：[`../README.md`](../README.md) · [`../01-overview.md`](../01-overview.md)

---

## ✨ v1.0.1 一句话

> 业务用户从空白数据库开始，**创建一个叫"出差报销"的应用 → 配"报销单"对象（5 字段）→ 画"新建报销单"表单（拖拽）→ 配置 2 节点审批流 → 发布并跑通"申请人提交 → 财务审批通过 → 状态变更"完整链路**。

---

## 📚 本版本文档（共 6 份）

| # | 文档 | 状态 |
|---|------|------|
| 1 | [`01-user-stories.md`](./01-user-stories.md) | ✅ 已就绪（9 个用户故事 + AC + Demo 剧本）|
| 2 | [`02-sprint-plan.md`](./02-sprint-plan.md) | ✅ 已就绪（6 个 Sprint，8 周）|
| 3 | [`03-test-cases.md`](./03-test-cases.md) | ✅ 已就绪（48 个用例）|
| 4 | [`04-test-report-template.md`](./04-test-report-template.md) | ✅ 已就绪（Sprint 5 末填）|
| 5 | [`05-app-service-architecture.md`](./05-app-service-architecture.md) | ✅ 已就绪（metaplatform-app-service 架构）|
| 6 | [`06-git-branching-and-release.md`](./06-git-branching-and-release.md) | ✅ 已就绪（Git 流程 + commit 规范）|

---

## 🚦 Sprint 阶段一览

```
Sprint 0 (Week 1) ── 脚手架 + DB + 契约
        │
Sprint 1 (Week 2-3) ── M1 应用骨架 + 对象模型
        │
Sprint 2 (Week 4-5) ── M2 表单编辑器 + 列表
        │
Sprint 3 (Week 6-7) ── M3 简单流程 + 审批
        │
Sprint 4 (Week 8) ── E2E 联调 + 测试 + 修复
        │
Sprint 5 (Week 8 后半) ── 评审 + 文档 + Release
        │
        ▼
  tag v1.0.1 + GitHub Release
```

---

## 🚀 启动开发（今天就开始）

### Step 1：创建 release 分支

```bash
cd d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform

git checkout main
git pull origin main
git checkout -b release/v1.0.1
git push -u origin release/v1.0.1
```

### Step 2：创建 Sprint 0 的 feature 分支

```bash
git checkout -b feature/v1.0.1-sprint0-scaffold
```

### Step 3：阅读文档

按顺序读以下文件，确认自己对 v1.0.1 的范围有完整理解：

1. [`01-user-stories.md`](./01-user-stories.md) — 我要交付什么？
2. [`02-sprint-plan.md`](./02-sprint-plan.md) — 我怎么交付？
3. [`05-app-service-architecture.md`](./05-app-service-architecture.md) — 我在哪里交付？
4. [`03-test-cases.md`](./03-test-cases.md) — 我要测什么？
5. [`06-git-branching-and-release.md`](./06-git-branching-and-release.md) — 我怎么合规交付？

### Step 4：Sprint 0 的具体任务

按 `02-sprint-plan.md` 的 Sprint 0 节，做完 T0-1 ~ T0-9 后，验收 Sprint 0 完成定义（DoD），再进 Sprint 1。

### Step 5：用 subagent 并行（推荐）

哪些任务派给 subagent：详见 [`02-sprint-plan.md` 第 7 章](../../v1.0.x/v1.0.1/02-sprint-plan.md)。

main agent 调度模板（在协同时复制即可）：

```markdown
# Task: [任务 ID] [任务名]

## 上下文
- 版本：v1.0.1（release/v1.0.1 分支）
- Sprint：[Sprint 号]
- 接口契约：docs/v1.0.x/v1.0.1/contract/openapi.yaml（具体端点）
- 涉及文件：[精确列出]

## 输入
- 上游 API：[接口路径 + 方法]
- 下游影响：[需要修改/扩展的其他文件]

## 输出要求
- 代码改动：[列出关键文件/函数]
- 自验证：[至少 3 条用例]
- 测试覆盖：[列出新增的 jest 文件]

## 不要做
- 不要改接口契约
- 不要碰 ontology-engine 关键集成（主线程做）
- 不要做超出 Sprint 范围的任务

## 完成后请告知
- diff 摘要
- 测试结果
- 是否需要主线程对接 ontology-engine / page-generator
```

---

## 🎯 关键 KPI（v1.0.1 通过的判定）

| 维度 | 阈值 |
|------|------|
| P0 测试用例通过率 | **100%** |
| 主路径 E2E（demo 剧本） | **10 步全绿** |
| 性能 P95 | 表单提交 < 500ms / 列表查询 < 800ms |
| 安全检查 | 0 高危 |
| 单测覆盖率 | 后端 ≥ 60% / 前端 ≥ 50% |
| Demo 剧本耗时 | < 10 分钟 |

**任一不达标则不进 v1.0.2，先修。**

---

## 📦 交付清单（Sprint 5 末产出）

- [ ] `metaplatform-app-service/` 完整代码（跑通）
- [ ] `metaplatform-frontend/` 新增 4 个页面 + 编辑器组件（跑通）
- [ ] `metaplatform-api/` 增加 /api/apps/** 反向代理
- [ ] `docs/v1.0.x/v1.0.1/test-reports/v1.0.1-test-report.md` 填好
- [ ] GitHub Release v1.0.1（含 Release Notes）
- [ ] demo 视频（10 分钟内）归档
- [ ] `CHANGELOG.md` 更新

---

## ❓ 常见疑问

### Q：今天（今天）就要交付代码吗？

A：**不是**。今天交付的是**计划 + 文档**，Sprint 0 是用脚手架 + DB 迁移打基础，**不要直接动手写大量代码**。先把 Sprint 0 做完（任务 T0-1 ~ T0-9）。

### Q：subagent 怎么开？

A：在主线程用 `Task` 工具，subagent_type 选 `general_purpose_task`，提供上面"Step 5"的调度模板。main agent 在收到结果后由人去 review。

### Q：第一次上手怎么最快出活？

A：建议路线：
1. 读完本文 + `01-user-stories.md` + `02-sprint-plan.md` 的 Sprint 0
2. 由 1 个 backend A + 1 个 frontend B 跑 Sprint 0（脚手架）
3. Sprint 1 开始正式派 subagent

---

## 📞 协作与沟通

| 角色 | 联络方式 |
|------|---------|
| PM | @xxx |
| Tech Lead | @xxx |
| 验收委员会（评审 v1.0.1 GA 时） | PM + Tech Lead + 测试 + 1 客户 |

**日同步**：每天 17:00 简版 standup（≤ 15 分钟）：
- 昨天完成了什么
- 今天做什么
- 阻塞是什么

---

## 文档版本

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-07-10 | 入口文档初版 |
