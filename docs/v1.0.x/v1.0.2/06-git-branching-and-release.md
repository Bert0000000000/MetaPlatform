# v1.0.2 Git 分支与发布流程

> **配套**：[`02-sprint-plan.md`](./02-sprint-plan.md) · [`04-test-report-template.md`](./04-test-report-template.md)
> **目的**：明确 v1.0.2 期间的 Git 工作流、Release 流程、Commit 规范
> **前置文档**：[`../v1.0.1/06-git-branching-and-release.md`](../v1.0.1/06-git-branching-and-release.md)

---

## 〇、仓库与 Git 远端

- **仓库根**：`d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform`
- **GitHub URL**：<https://github.com/Bert0000000000/MetaPlatform>
- **默认分支**：`main`（永远保持可发布状态）
- **保护分支**：`main` 必须 PR 合入 + CI 通过

---

## 一、分支模型（v1.0.2 适配）

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│   main (default, protected)                                      │
│    │                                                             │
│    ├─ ← release/v1.0.1 (已合并，含 v1.0.1 tag)                   │
│    │                                                             │
│    └─ PR ← release/v1.0.2 (合并 + 打 tag v1.0.2)                 │
│           │                                                      │
│           ├─ PR ← feature/lookup-field (Sprint 1)                │
│           ├─ PR ← feature/advanced-list (Sprint 1)               │
│           ├─ PR ← feature/csv-import-export (Sprint 2)           │
│           ├─ PR ← feature/app-template (Sprint 2)                │
│           ├─ PR ← feature/row-level-auth (Sprint 3)              │
│           ├─ PR ← feature/multi-col-form (Sprint 3)              │
│           ├─ PR ← feature/perf-cache (Sprint 4)                  │
│           └─ PR ← docs/v1.0.2 (文档同步，每次 sprint 一份)        │
│                                                                  │
│   hotfix/v1.0.2-xxx                                              │
│    └─ PR ← main（从 main 切出 → 修复 → PR → main + release）     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 1.1 分支类型

| 类型 | 命名 | 生命周期 | 合入目标 |
|------|------|---------|---------|
| **release** | `release/v1.0.x` | 整个 minor 周期 | main |
| **feature** | `feature/<epic>-<name>` | 一个 Sprint | release/v1.0.x |
| **hotfix** | `hotfix/v1.0.x-<fix>` | 紧急修复 | main + release/v1.0.x |
| **docs** | `docs/v1.0.x-<topic>` | 文档同步 | release/v1.0.x |

---

## 二、版本号策略

### 2.1 v1.0.2 在 v1.0.x 系列中的位置

```
v1.0.1 ── tag v1.0.1 (已发布)
   │
   └─ v1.0.2 ── tag v1.0.2 (本次开发)
                  │
                  └─ v1.0.3 ── 计划中
```

### 2.2 版本号规则（与 v1.0.1 一致）

格式：`v[major].[minor].[patch]`

- **major**：里程碑式变化（如 v1.0.x → v1.1.0 增加 AI 能力）
- **minor**：能力切片（如 v1.0.1 → v1.0.2 加关联对象）
- **patch**：hotfix（如 v1.0.2.1 修复某个 bug）

### 2.3 v1.0.2 的预发布 tag（可选）

如果需要分阶段发布：

```
v1.0.2-alpha.1   (Sprint 1 末)
v1.0.2-alpha.2   (Sprint 2 末)
v1.0.2-rc.1      (Sprint 3 末)
v1.0.2-rc.2      (Sprint 4 末)
v1.0.2           (Sprint 5 末, 最终)
```

---

## 三、Commit 规范（与 v1.0.1 一致）

### 3.1 Conventional Commits

```
<type>(<scope>): <subject>

<body>

<footer>
```

### 3.2 Type 取值

| Type | 用途 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat(lookup): add lookup field type to AppObject` |
| `fix` | 修 bug | `fix(csv-import): handle BOM correctly in UTF-8 files` |
| `refactor` | 重构（无功能变化） | `refactor(instance): split InstanceService into create/update` |
| `perf` | 性能 | `perf(cache): add Caffeine cache to AppObjectFieldService` |
| `test` | 测试 | `test(e2e): add 9 cases for lookup field workflow` |
| `docs` | 文档 | `docs(v1.0.2): add user-stories with L1-L4 epics` |
| `chore` | 杂项 | `chore(deps): bump spring-boot to 3.2.4` |

### 3.3 Scope 取值（v1.0.2 新增）

| Scope | 含义 |
|-------|------|
| `lookup` | 关联字段相关 |
| `list` | 列表页相关 |
| `csv` | CSV 导入导出 |
| `template` | 应用模板 |
| `auth-row` | 行级权限 |
| `auth-col` | 字段级权限（v1.0.1 增量） |
| `form-layout` | 表单布局 |
| `cache` | 缓存层 |
| `instance` | 对象实例 |

### 3.4 Subject 规范

- 中文优先（项目内沟通方便）
- 50 字以内
- 不加句号
- 用动词开头

**示例**：

```bash
git commit -m "feat(lookup): 添加关联字段类型, 支持配置目标对象 + 显示字段"
git commit -m "fix(csv-import): 修复 UTF-8 BOM 文件解析失败"
git commit -m "perf(cache): 给 AppObjectFieldService 加 Caffeine 缓存, TTL 5min"
git commit -m "docs(v1.0.2): 添加 7 份文档 + 56 个测试用例"
```

---

## 四、PR 流程

### 4.1 PR 创建规则

| 规则 | 说明 |
|------|------|
| **base branch** | `release/v1.0.2`（feature/ → release/） |
| **head branch** | `feature/lookup-field`（你的开发分支） |
| **title** | 必填，使用 `[v1.0.2] feat(lookup): 添加关联字段类型` 格式 |
| **description** | 必填：改动概述 + 测试 + 截图 + 关联 AC |
| **reviewer** | 至少 1 个后端 + 1 个前端（按改动模块） |
| **关联 AC** | 引用 `01-user-stories.md` 中的 AC 编号 |
| **CI** | typecheck + 单测 + e2e 必须通过 |

### 4.2 PR 模板

```markdown
## 改动概述

<!-- 1-3 句话说清楚做了什么 -->

## 关联 AC

<!-- 列出此 PR 实现的 AC 编号 -->
- AC-201.1
- AC-201.2

## 测试

<!-- 已跑的测试 -->
- [x] 单测 `npm run test:unit`
- [x] e2e: `npm run test:e2e -- --grep "lookup"`
- [x] typecheck: `npm run typecheck`

## 截图 / 录屏

<!-- UI 改动必填 -->

## 备注

<!-- 风险、副作用、留到后续版本 -->
```

---

## 五、Release 流程（Sprint 5 末）

### 5.1 发布检查清单

```
□ 所有 P0 AC 通过
□ 所有 P1 AC ≥ 90% 通过
□ E2E 测试全绿（56 个用例）
□ 性能指标达标
□ 安全指标达标
□ 向后兼容测试通过（v1.0.1 → v1.0.2）
□ 数据迁移验证通过
□ Release Notes 已写
□ CHANGELOG 已更新
□ demo 视频 / 截图齐备
```

### 5.2 发布步骤

```bash
# 1. 从 main 拉新分支
git checkout main
git pull origin main
git checkout -b release/v1.0.2

# 2. 合并所有 feature 分支
git merge --no-ff feature/lookup-field -m "Merge feature/lookup-field into release/v1.0.2"
git merge --no-ff feature/advanced-list -m "Merge feature/advanced-list into release/v1.0.2"
git merge --no-ff feature/csv-import-export -m "Merge feature/csv-import-export into release/v1.0.2"
git merge --no-ff feature/app-template -m "Merge feature/app-template into release/v1.0.2"
git merge --no-ff feature/row-level-auth -m "Merge feature/row-level-auth into release/v1.0.2"
git merge --no-ff feature/multi-col-form -m "Merge feature/multi-col-form into release/v1.0.2"
git merge --no-ff feature/perf-cache -m "Merge feature/perf-cache into release/v1.0.2"

# 3. 跑一遍全量测试
cd metaplatform-frontend && npm run test && npm run typecheck
cd ../metaplatform-app-service && mvn verify

# 4. 合并到 main
git checkout main
git merge --no-ff release/v1.0.2 -m "Release v1.0.2: Link+Export"

# 5. 打 tag
git tag -a v1.0.2 -m "v1.0.2 Link+Export - 关联对象 + 高级列表 + 导入导出 + 行级权限"
git push origin main --tags

# 6. GitHub Release
gh release create v1.0.2 \
    --title "v1.0.2 Link+Export" \
    --notes-file docs/v1.0.x/v1.0.2/RELEASE-NOTES.md
```

---

## 六、Hotfix 流程（v1.0.2 之后）

### 6.1 触发条件

- v1.0.2 发布后发现 P0/P1 bug
- 需要紧急修复但 v1.0.3 还在 Sprint 1

### 6.2 步骤

```bash
# 1. 从 main 切 hotfix 分支
git checkout main
git pull
git checkout -b hotfix/v1.0.2-fix-xxx

# 2. 修复 + 提交
git commit -m "fix(xxx): 修复 ... (closes #123)"

# 3. 跑测试
npm run test && mvn verify

# 4. 合回 main + 打 tag
git checkout main
git merge --no-ff hotfix/v1.0.2-fix-xxx
git tag -a v1.0.2.1 -m "hotfix: xxx"
git push origin main --tags

# 5. cherry-pick 到 release/v1.0.2（如果还在维护）
git checkout release/v1.0.2
git cherry-pick <hotfix-commit-hash>
```

---

## 七、Sprint 1 启动步骤（具体命令）

```bash
# 假设今天 Sprint 1 开始
cd D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform

# 1. 拉最新 main
git checkout main
git pull origin main

# 2. 创建 release/v1.0.2 分支
git checkout -b release/v1.0.2
git push -u origin release/v1.0.2

# 3. 创建 Sprint 1 特性分支
git checkout -b feature/lookup-field
git push -u origin feature/lookup-field

git checkout release/v1.0.2
git checkout -b feature/advanced-list
git push -u origin feature/advanced-list

# 4. 在 feature/lookup-field 上开始开发
git checkout feature/lookup-field
# ... 编写代码 ...
git add .
git commit -m "feat(lookup): 添加关联字段类型"
git push

# 5. 创建 PR
gh pr create --base release/v1.0.2 --head feature/lookup-field \
    --title "[v1.0.2] feat(lookup): 添加关联字段类型" \
    --body "关联 AC-201.1, AC-201.2"

# 6. 合并后清理
git checkout release/v1.0.2
git pull
git branch -d feature/lookup-field
```

---

## 八、版本兼容策略（重要）

### 8.1 与 v1.0.1 并存

v1.0.2 发布后，main 分支永远是 v1.0.2。如果要同时维护 v1.0.1：

```
main                ← v1.0.2 (latest)
release/v1.0.1      ← v1.0.1 (LTS, 仅 hotfix)
```

### 8.2 hotfix 同时打两个 tag

```bash
# 修复同时影响 v1.0.1 和 v1.0.2
git checkout release/v1.0.1
git cherry-pick <hotfix-commit>
git tag v1.0.1.1

git checkout release/v1.0.2
git cherry-pick <hotfix-commit>
git tag v1.0.2.1
```

---

## 九、CI/CD 配置建议（未来 Sprint 引入）

### 9.1 GitHub Actions

```yaml
# .github/workflows/v1.0.2-ci.yml
name: v1.0.2 CI
on:
  pull_request:
    branches: [release/v1.0.2, main]
jobs:
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: cd metaplatform-frontend && npm ci
      - run: npm run typecheck
      - run: npm run test
      - run: npm run build

  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: { java-version: 21, distribution: temurin }
      - run: cd metaplatform-app-service && ./mvnw verify
```

### 9.2 自动化 e2e

合并到 release/v1.0.2 时自动跑 Playwright，失败则阻止合入。

---

## 十、文档与代码同分支

| 文档 | 提交位置 |
|------|---------|
| `docs/v1.0.x/v1.0.2/*.md` | 与代码在同一 PR |
| `CHANGELOG.md` | 在 release tag 前单独 PR |
| GitHub Release Notes | 在 tag 创建后由 PM 手动写 |

---

## 十一、与 v1.0.1 工作流的差异

| 维度 | v1.0.1 | v1.0.2 |
|------|--------|--------|
| base 分支 | `release/v1.0.1` | `release/v1.0.2` |
| 主要 feature 数 | 5 | 7 |
| 测试用例数 | 48 | 56 |
| 文档份数 | 6 | 7 (+1 migration) |
| 预发布 tag | 不强制 | 建议 alpha/rc |
| 数据迁移 | 无 | 必须 (见 07) |
| 向后兼容测试 | 无 | 必须 |

详细 Git 命令行示例见 [v1.0.1 工作流](../v1.0.1/06-git-branching-and-release.md)，本章只列差异点。