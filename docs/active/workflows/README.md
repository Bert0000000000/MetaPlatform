# MetaPlatform v6.0 CI/CD 配置

> **文档**：v6.0 monorepo 的 CI/CD 配置模板
> **时机**：新仓库 `MetaPlatform-v6` 创建时直接用
> **关联 spec**：[`../specs/2026-08-19-mp-v6-architecture.md`](../specs/2026-08-19-mp-v6-architecture.md) §7.16

---

## 1. 4 个 workflow 文件

| 文件 | 触发 | 用途 |
|---|---|---|
| `ci.yml` | PR + push main | lint / typecheck / test / build / **evidence-check** / secret-scan / helm-validate / rls-check |
| `release.yml` | tag v* | 构建 + 推 Harbor + 扫描 + 部署 staging + 创建 Release |
| `deploy-prod.yml` | manual + 审批 | 蓝绿部署到生产 + smoke test + 通知 |
| `claude-loop.yml` | manual | Claude Code loop 自动接力 Batch |

**强约束的 8 项 CI gate**（取代 v3.0 的 13 硬规则）：

| # | CI gate | 对应原规则 |
|---|---|---|
| 1 | lint | #6 |
| 2 | typecheck | #6 |
| 3 | test | #7 |
| 4 | build | #6 |
| 5 | **evidence-check** | #10 |
| 6 | secret-scan (gitleaks) | #12 |
| 7 | helm-validate (kubeconform) | #8 #13 |
| 8 | rls-check | #3 |

---

## 2. 安装步骤（新仓库创建时）

```bash
# 1. 创建新仓库
gh repo create your-org/MetaPlatform-v6 --private --clone

cd MetaPlatform-v6

# 2. 复制 4 个 workflow 文件
mkdir -p .github/workflows
cp /path/to/v6.0-ci-templates/.github/workflows/* .github/workflows/

# 3. 配置 GitHub Secrets
gh secret set ANTHROPIC_API_KEY
gh secret set HARBOR_USERNAME
gh secret set HARBOR_PASSWORD
gh secret set ARGOCD_USERNAME
gh secret set ARGOCD_PASSWORD
gh secret set ARGOCD_SERVER
gh secret set SLACK_WEBHOOK_PROD

# 4. 配置 main 分支保护
gh api repos/:owner/:repo/branches/main/protection \
  --input - <<EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "Lint", "Typecheck", "Test", "Build",
      "Evidence Document Check", "Secret Scan",
      "Helm + NetworkPolicy Validate", "RLS Policy Check"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true
  },
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF

# 5. 设置默认分支 + squash merge only
gh api repos/:owner/:repo -X PATCH \
  --input - <<EOF
{
  "default_branch": "main",
  "allow_squash_merge": true,
  "allow_merge_commit": false,
  "allow_rebase_merge": false
}
EOF

# 6. 启用自动删除已合并分支
gh api repos/:owner/:repo -X PATCH \
  --input '{"delete_branch_on_merge": true}'

echo "✅ v6.0 仓库 CI 配置完成"
```

---

## 3. 分支命名 + commit + PR 规范

### 3.1 分支

```
feat/mp-v6-<batch-name>     # 每个 Batch 一个分支
fix/<scope>-<id>             # 紧急修复
chore/<scope>-<desc>          # 工具 / 文档
exp/<user>/<desc>            # 实验
```

### 3.2 commit（Conventional Commits）

```bash
feat(scope): description
fix(scope): description
chore(scope): description
docs(scope): description
refactor(scope): description
test(scope): description
ci(scope): description
perf(scope): description
```

### 3.3 PR 标题

```
feat(scope): MP-V6-BATCH-NN #N description
```

**示例**：`feat(foundation): MP-V6-FOUNDATION-01 #1 K8s + Supabase 8 capabilities`

---

## 4. Claude Code loop 启动```bash
# 单 Batch
claude --loop .claude/loop-prompt.md --batch MP-V6-FOUNDATION-01# 链式（自动找下一个未完成）
claude --loop .claude/loop-prompt.md --chain# GitHub Actions 触发
# 手动：Actions → Claude Code Loop → Run workflow
```

---

## 5. 完整流程

```
开发者在 main 上拉新分支
  ↓
git checkout -b feat/mp-v6-<batch>
  ↓
开发 + 写 evidence
  ↓
commit (Conventional Commits) + push
  ↓
创建 PR（用 PULL_REQUEST_TEMPLATE.md）
  ↓
CI 8 项 gate 全部通过
  ↓
评审通过（1+ approval）
  ↓
squash merge → 自动删除分支
  ↓
Claude Code loop 自动开下一个 Batch
```

---

## 6. 一句话

> **4 个 workflow 文件 + 8 项 CI gate + main 分支保护 + Claude Code loop 自动化 = v6.0 monorepo CI/CD 完整方案。Sprint 0 启动时直接套用。**

---

*v6.0 CI/CD 配置完毕。*