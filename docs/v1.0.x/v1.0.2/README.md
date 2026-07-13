# v1.0.2「Link+Export」 版本文档（入口）

> 本文档是 **v1.0.2「Link+Export」** 的总入口。
>
> **父级**：[`../README.md`](../README.md) · [`../01-overview.md`](../01-overview.md)
> **前置版本**：[`../v1.0.1/`](../v1.0.1/) — 应用中心 MVP + 表单 + 基本流程
> **下一版本**：[`../v1.0.3/`](../v1.0.3/) — 流程 + 审批闭环（计划中）

---

## ✨ v1.0.2 一句话

> 在 v1.0.1 已有的"应用 + 表单 + 流程"基础上，业务用户**为对象添加关联字段（关联另一个对象）→ 配置高级列表（搜索/排序/过滤/分页/列控制/导出）→ 导入/导出应用模板（JSON）和实例数据（CSV/Excel）→ 让数据真正"流"起来**。

---

## 🎯 核心交付（用户能用什么）

| 能力 | 描述 | 对应 Roadmap |
|------|------|--------------|
| **关联字段** (lookup/reference) | 在 AppObject 中支持 `lookup: { objectId, fieldCode }` 类型；表单可下拉选择其它对象的实例；列表可显示关联对象的展示字段 | F7.2.5 |
| **高级列表** | 列表页支持搜索/排序/过滤/分页/列宽拖拽/列显示隐藏/列固定/导出当前页 | 增量增强 F4.4.3 |
| **CSV/Excel 导入导出** | 对象实例数据可导出 CSV；CSV 文件可导入（字段映射 + 校验）；Excel 1 期只支持导入（CSV 后处理） | F4.4.1.4 |
| **应用模板导入/导出** | 整个应用打包为 JSON，含 schema + pages + workflows，可在新环境导入复用 | F4.3.9 |
| **行级权限** | 在 v1.0.1 字段级权限基础上，加**行级权限**：按角色过滤可见行（owner / department / all） | F4.6.7 增强 |
| **多列布局表单** | v1.0.1 限制 1 列 → v1.0.2 开放 2/3/4 列栅格布局 | AC-201.5 修复 |
| **批量操作** | 列表页支持批量删除/批量更新字段/批量导入 | 新增 |
| **性能优化** | listObjects 分页 + schema_json 缓存 + PublicForm ETag 304 | B1, B3, B5 |

---

## 📚 本版本文档（共 7 份）

| # | 文档 | 状态 |
|---|------|------|
| 1 | [`01-user-stories.md`](./01-user-stories.md) | ✅ 已就绪（8 个用户故事 + AC + Demo 剧本）|
| 2 | [`02-sprint-plan.md`](./02-sprint-plan.md) | ✅ 已就绪（5 个 Sprint，5 周）|
| 3 | [`03-test-cases.md`](./03-test-cases.md) | ✅ 已就绪（56 个用例）|
| 4 | [`04-test-report-template.md`](./04-test-report-template.md) | ✅ 已就绪（Sprint 4 末填）|
| 5 | [`05-app-service-architecture.md`](./05-app-service-architecture.md) | ✅ 已就绪（v1.0.2 增量架构）|
| 6 | [`06-git-branching-and-release.md`](./06-git-branching-and-release.md) | ✅ 已就绪（Git 流程 + commit 规范）|
| 7 | [`07-migration-from-v1.0.1.md`](./07-migration-from-v1.0.1.md) | ✅ 已就绪（v1.0.1 → v1.0.2 数据迁移 + 向后兼容）|

---

## 🚦 Sprint 阶段一览

```
Sprint 1 (Week 1-2) ── 关联字段 (lookup) + 列表增强
        │
Sprint 2 (Week 3) ── 导入导出 (CSV/Excel) + 应用模板 (JSON)
        │
Sprint 3 (Week 4) ── 行级权限 + 多列布局 + 批量操作
        │
Sprint 4 (Week 5) ── 性能优化 + E2E 联调 + 测试
        │
Sprint 5 (Week 5 后半) ── 评审 + 文档 + Release
        │
        ▼
  tag v1.0.2 + GitHub Release
```

---

## 🔗 与 v1.0.1 的关系

| 维度 | v1.0.1 | v1.0.2 增量 |
|------|--------|------------|
| 对象字段类型 | string / number / date / select / text 等 10 个 | **+lookup (关联对象)** |
| 列表页 | 简单列表 + 分页 | **+搜索/排序/过滤/列控制/导出** |
| 数据流转 | 只能手动录入 | **+CSV 导入导出 + 应用模板导入导出** |
| 权限粒度 | 字段级（AC-302.6） | **+行级（按角色过滤）** |
| 表单布局 | 1 列（AC-201.5） | **+多列栅格** |
| 后端 | listObjects 全量 | **+分页 + 缓存** |

---

## 🚫 不在本版本范围内

明确**不做**的事项（避免范围蔓延）：

- ❌ **BPMN 2.0 复杂流程**：留到 v1.0.4
- ❌ **AI 能力 / 数字员工 / VibeCoding**：留到 v1.1.0
- ❌ **多环境发布**：留到 v1.0.6
- ❌ **OpenAPI 文档自动生成**：留到 v1.0.6
- ❌ **附件字段（OSS）**：留到 v1.0.5
- ❌ **公式字段**：留到 v1.0.3 P1 加分项

---

## 🚀 启动开发

```bash
# 1. 从 main 拉新分支
git checkout main
git pull
git checkout -b release/v1.0.2

# 2. 创建子特性分支
git checkout -b feature/lookup-field
git checkout -b feature/advanced-list
git checkout -b feature/csv-export
git checkout -b feature/app-template
git checkout -b feature/row-level-auth
git checkout -b feature/multi-col-form
git checkout -b feature/perf-cache

# 3. 启动 metaplatform-app-service 开发
cd metaplatform-app-service
mvn spring-boot:run

# 4. 启动 frontend
cd metaplatform-frontend
npm run dev
```

详细 Git 流程见 [`06-git-branching-and-release.md`](./06-git-branching-and-release.md)。

---

## 📞 联系方式 / 协作

- **PM / Tech Lead**：通过 [`02-sprint-plan.md`](./02-sprint-plan.md) 跟踪进度
- **测试**：提交 `test-reports/v1.0.2/` 目录
- **AI 协同**：使用 `general_purpose_task` subagent 做特性开发
- **GitHub**：<https://github.com/Bert0000000000/MetaPlatform>

---

## 版本历史

| 日期 | 版本 | 变更 |
|------|------|------|
| 2026-07-13 | v1.0.2 | 文档初建（基于 v1.0.1 模板复制并重写）|