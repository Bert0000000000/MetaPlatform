# v1.0.1 Git 分支与发布流程

> **配套**：[`02-sprint-plan.md`](./02-sprint-plan.md) · [`04-test-report-template.md`](./04-test-report-template.md)
> **目的**：明确 v1.0.1 期间的 Git 工作流、Release 流程、Commit 规范

---

## 〇、仓库与 Git 远端

- **仓库根**：`d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform`
- **GitHub URL**：<https://github.com/Bert0000000000/MetaPlatform>
- **默认分支**：`main`（永远保持可发布状态）
- **保护分支**：`main` 必须 PR 合入 + CI 通过

---

## 一、分支模型

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│   main (default, protected)                                      │
│    │                                                             │
│    └─ PR ← release/v1.0.1 (合并 + 打 tag v1.0.1)                 │
│           │                                                      │
│           ├─ PR ← feature/app-service-scaffold (Sprint 0)        │
│           ├─ PR ← feature/app-m1-apis (Sprint 1)                 │
│           ├─ PR ← feature/app-m2-forms (Sprint 2)                │
│           ├─ PR ← feature/app-m3-workflow (Sprint 3)             │
│           ├─ PR ← feature/e2e-tests (Sprint 4)                   │
│           └─ PR ← docs/v1.0.1 (文档同步，每次 sprint 一份)        │
│                                                                  │
│   hotfix/v1.0.1-xxx                                              │
│    └─ PR ← main（从 main 切出 → 修复 → PR → main + develop）     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 1.1 分支类型

| 分支类型 | 命名规则 | 用途 | 谁能推 | 谁能合 |
|---------|---------|------|--------|--------|
| `main` | `main` | 默认分支，永远可发布 | ❌ | Tech Lead |
| `release/*` | `release/vX.Y.Z` | 一个 minor 版本发布 | 主线程 | Tech Lead |
| `feature/*` | `feature/<name>` | 单个特性 / 子任务 | 任何人 | PR review 后 |
| `hotfix/*` | `hotfix/vX.Y.Z-<name>` | 主分支后的紧急修复 | Tech Lead | Tech Lead |
| `docs/*` | `docs/<scope>` | 仅文档改动 | 任何人 | Tech Writer |

### 1.2 Sprint 0 启动时立刻创建的分支

```bash
# 主线程（PM/Tech Lead）
git checkout main
git pull origin main
git checkout -b release/v1.0.1
git push -u origin release/v1.0.1
```

**所有 Sprint 1~5 的特性分支都基于 `release/v1.0.1` 派生，最终都 PR 回 `release/v1.0.1`**。

---

## 二、Commit 规范（Conventional Commits）

> 每次 commit 必须可解析，CI 会基于 commit 类型决定行为（变更日志生成、是否 bump 版本）。

### 2.1 格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### 2.2 允许的 type

| type | 含义 | 例子 |
|------|------|------|
| `feat` | 新功能 | `feat(app-center): 新建应用接口 POST /api/apps` |
| `fix` | Bug 修复 | `fix(app-center): 修复应用名重复 500 错误` |
| `docs` | 文档 | `docs(v1.0.1): 写用户故事文档` |
| `refactor` | 重构（无功能变化） | `refactor(app-service): 提取 Repository` |
| `test` | 测试相关 | `test(app-center): 加表单提交 E2E 用例` |
| `chore` | 构建/工具变更 | `chore(ci): 加 GitHub Actions` |
| `perf` | 性能 | `perf(list): 加索引 list_query_idx` |
| `style` | 格式 | `style(eslint): 修复 lint 错误` |

### 2.3 scope 取值

| scope | 含义 |
|-------|------|
| `app-center` / `app-service` | metaplatform-app-service |
| `frontend` | metaplatform-frontend |
| `api` | metaplatform-api |
| `ontology` | metaplatform-ontology-engine |
| `page-generator` | metaplatform-page-generator |
| `docs` | 文档 |
| `release` | 版本相关 |
| `infra` | CI / DevOps |

### 2.4 例子

```bash
git commit -m "feat(app-service): 实现 POST /api/apps 创建应用接口

- 新增 apps.routes.ts
- 新增 apps.service.ts 业务层
- 加 audit_log
- 加 4 个单测覆盖

Closes #101"
```

### 2.5 Git Hooks（本地自动检查）

在仓库根添加 `.husky/commit-msg`：

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx commitlint --edit $1
```

`commitlint.config.js`：

```js
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      ['app-service', 'frontend', 'api', 'ontology', 'page-generator', 'docs', 'release', 'infra'],
    ],
  },
};
```

---

## 三、PR 流程

### 3.1 PR 创建要求

每次 PR 必须满足：

1. **标题**：`<type>(<scope>): <subject>`（与 commit 一致）
2. **描述**：包含
   - 关联 issue（用 `Closes #101`）
   - 改动文件列表
   - 测试覆盖说明
   - 截图（如有 UI 改动）
3. **关联的 checklist**：
   - [ ] 单测已加（覆盖率未降低）
   - [ ] E2E 已加（如有新用户故事）
   - [ ] 文档已同步（用户故事/API 文档/CHANGELOG）
   - [ ] 本地 `npm run build` 通过
   - [ ] 自测通过

### 3.2 PR 模板（`.github/PULL_REQUEST_TEMPLATE.md`）

```markdown
## 描述

> 这个 PR 做什么

## 关联 Issue

Closes #

## 改动列表

- [ ] 后端
- [ ] 前端
- [ ] 数据库
- [ ] 文档
- [ ] 测试

## 测试说明

- 单测：_个，新增_个
- E2E：_个，新增_个
- 手动测试过：xxx

## 截图

（UI 改动必须）

## Checklist

- [ ] 单元测试已加
- [ ] E2E 用例已加
- [ ] 文档已更新
- [ ] 本地 build 通过
- [ ] commit 信息符合规范
```

### 3.3 Review 规则

| 角色 | 责任 |
|------|------|
| Author | 写 PR 描述 + 跑完自测 |
| Reviewer | 看代码逻辑 + 测试覆盖 + 文档 |
| Tech Lead | 关键路径必须亲自 review |

**至少 1 个 reviewer 通过**才能 merge。

---

## 四、Release 流程

### 4.1 Sprint 5 末（评审通过后）

```bash
# 1. 主线程切到 release 分支
git checkout release/v1.0.1
git pull origin release/v1.0.1

# 2. 验证 CI 全绿
# （在 GitHub 上看：所有 workflow 必须绿）

# 3. 合并 release 到 main（PR）
gh pr create \
  --base main \
  --head release/v1.0.1 \
  --title "release: v1.0.1「Forge+Flow」" \
  --body "见 docs/v1.0.x/v1.0.1/04-test-report-template.md"

# 4. 等 PR 通过后，Tech Lead merge

# 5. 打 tag v1.0.1
git checkout main
git pull origin main
git tag -a v1.0.1 -m "v1.0.1「Forge+Flow」

详见：
- docs/v1.0.x/v1.0.1/01-user-stories.md
- docs/v1.0.x/v1.0.1/02-sprint-plan.md
- docs/v1.0.x/v1.0.1/test-reports/v1.0.1-test-report.md"
git push origin v1.0.1

# 6. 创建 GitHub Release
gh release create v1.0.1 \
  --title "v1.0.1「Forge+Flow」" \
  --notes-file docs/v1.0.x/v1.0.1/release-notes/v1.0.1.md \
  --target main
```

### 4.2 Release Notes 模板

`docs/v1.0.x/v1.0.1/release-notes/v1.0.1.md`：

```markdown
# v1.0.1「Forge+Flow」 Release Notes

发布日期：YYYY-MM-DD

## ✨ 新功能

- **应用中心**：完整 MVP，支持创建应用 + 配置对象 + 生成表单
- **表单编辑器**：拖拽式设计器，支持 5 种基础字段类型
- **列表 + 查询**：分页 + 排序 + 过滤
- **简单流程**：2 节点审批流（开始→用户任务→结束）

## 🐛 修复

- 应用名重复 500 错误 (#105)

## 📊 性能

- 表单提交 P95 < 500ms ✅
- 列表查询（1w 数据）P95 < 800ms ✅

## 🔒 安全

- 跨用户数据隔离测试 100% 通过
- SQL 注入 + XSS 测试通过

## 📚 文档

- 新增 6 份文档到 docs/v1.0.x/v1.0.1/
- 更新 README.md 新增 metaplatform-app-service 快速开始

## 🔄 升级指南

无破坏性变更，从 v1.0.0 升级：

```bash
git fetch
git checkout v1.0.1
npm install --workspaces
npm run build
# 自动迁移脚本（如有）
node scripts/migrate-to-v1.0.1.js
```

## 🐳 Docker

```bash
docker pull Bert0000000000/MetaPlatform:v1.0.1
```

---

完整变更：<https://github.com/Bert0000000000/MetaPlatform/compare/v1.0.0...v1.0.1>
```

### 4.3 CHANGELOG 同步

根目录 `CHANGELOG.md` 追加：

```markdown
## [v1.0.1] - 2026-XX-XX

### Added
- metaplatform-app-service（应用中心独立微服务）
- POST /api/apps 等 18 个新 API
- 表单编辑器 + 列表页 + 流程编辑器（前端 4 个新页面）

### Changed
- metaplatform-api 增加 /api/apps/** 反向代理

### Fixed
- 应用名重复 500 错误 (#105)

### Performance
- 表单提交 P95 < 500ms
- 列表查询（1w 数据）P95 < 800ms

[完整 release notes](https://github.com/Bert0000000000/MetaPlatform/releases/tag/v1.0.1)
```

---

## 五、Hotfix 流程

> 重要补丁不进 minor 版本，单独 hotfix。

```bash
# 1. 从 main 切 hotfix 分支
git checkout main
git checkout -b hotfix/v1.0.1-fix-xxx

# 2. 修复 + 加测试 + commit（仍然符合 conventional）
git commit -m "fix(app-service): xxx"

# 3. PR 合入 main
gh pr create --base main --head hotfix/v1.0.1-fix-xxx

# 4. PR 合入后打新 tag v1.0.2
git tag -a v1.0.2 -m "hotfix: xxx"
git push origin v1.0.2
```

> **注意**：hotfix 不影响 release/v1.0.1，因为是已发布的"真补丁"。

---

## 六、subagent 提交规范

> 当使用 `general_purpose_task` subagent 写代码时：

1. **subagent 在哪个分支写？** → 在主线程创建的 `feature/<name>` 分支上写
2. **commit 由谁做？** → subagent 提交 commit 信息，主线程 + 人 review 后 merge
3. **PR 由谁开？** → 主线程（基于 subagent 提交的分支）

### 6.1 工作流

```
PM（主线程）
  ├─ 创建 feature/<name> 分支
  ├─ 启动 subagent（提供完整上下文 + 接口契约）
  │      │
  │      └─ subagent 写代码 + commit（push 到 origin/feature/<name>）
  │
  ├─ Pull latest
  ├─ 本地验证
  ├─ 提 PR 到 release/v1.0.1
  └─ 合并到 release/v1.0.1
```

### 6.2 subagent 输出要求

每次 subagent 必须返回：

```markdown
## 任务结果

### 改了哪些文件（diff）
```
src/routes/apps.routes.ts        (+50 -0)
src/domain/app/app.service.ts    (+30 -0)
src/db/migrations/002_apps.sql   (+20 -0)
... 
```

### 跑了什么测试（结果）
- `npm test` → 4 个单测全绿 ✅
- `npm run lint` → 0 errors ✅
- 手动 curl 测试 → POST /api/apps 200 ✅

### 是否需要主线程对接 ontology-engine / page-generator
- [ ] ontology-engine 客户端封装（关键集成，主线程做）
- [ ] page-generator 校验（次要集成，主线程做）

### 是否引入新依赖
- 是：新增 jsonwebtoken（JWT 解析）

### 未知 / 不确定
- 表名命名规范（应该用 snake_case 还是驼峰），需要主线程确认
```

---

## 七、CI / CD 流水线

### 7.1 GitHub Actions 配置

> 已在 `metaplatform-app-service` 的 `[05-app-service-architecture.md](./05-app-service-architecture.md)` 中给出片段，详细配置在 Sprint 0 实装。

### 7.2 CI 流水线级别

```yaml
# Lint + TypeCheck + Test（每个 PR）
on: [pull_request]
jobs:
  - name: lint
  - name: typecheck
  - name: test (with coverage)
  - name: build

# Release 流水线（tag push 后触发）
on:
  push:
    tags:
      - 'v*'
jobs:
  - name: build-docker
  - name: push-docker
  - name: create-github-release
```

---

## 八、Convention 总结（一页纸）

```
┌─────────────────────────────────────────────────────────────────┐
│ MetaPlatform Git 一页纸                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 分支命名：                                                       │
│   main                                                         │
│   release/v1.0.x                                                │
│   feature/<短英文描述>                                          │
│   hotfix/v1.0.x-<问题>                                         │
│   docs/<范围>                                                  │
│                                                                 │
│ Commit：                                                         │
│   <type>(<scope>): <subject>                                   │
│   例子：feat(app-service): 新建应用接口 POST /api/apps            │
│                                                                 │
│ PR：                                                             │
│   title 必须 <type>(<scope>): ...                                │
│   必须 1 个 reviewer 通过                                          │
│   关联 issue（Closes #）                                          │
│   Checklist 5 项必须勾选                                          │
│                                                                 │
│ Release：                                                        │
│   每个 minor 一条 release 分支                                    │
│   合并 release 到 main → tag v1.0.x → GitHub Release              │
│   hotfix → tag v1.0.x.y                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 九、相关文档

- [Conventional Commits 规范](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)
- 项目内 `CONTRIBUTING.md`（待编）

---

## 文档版本

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-07-10 | 初版 |
