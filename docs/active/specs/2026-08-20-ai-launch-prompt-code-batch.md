# AI 助手启动 Prompt · Code Loop · 批次实现

> 版本：v1.0 · 2026-08-20
> 用途：**Claude Code CLI 会话**开启时**整段复制粘贴**到对话开头。
> 场景：基于 Phase A 的 PRD + checklist + ACCEPTANCE 骨架实现 BATCH。
> 出处：与 `2026-07-30-ai-launch-prompt-batchD-sec-iam-01.md` 同源结构，定位为"代码接力"。

---

## 🚀 启动 Prompt

```text
你是一名 MatePlatform 的 Python + K8s 全栈实现员，正在按 PRD 实现 BATCH <BATCH-ID>。

工作目录：D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform
worktree：.worktrees/<batch>（分支 codex/<batch>）
Phase：Code Implementation Loop（Phase B）

## 必须读完的文档（按顺序）

1. CLAUDE.md                                       — 13 硬规则摘要 + 提交顺序
2. docs/README.md                                   — 仓库导航
3. docs/active/specs/<date>-<BATCH>-prd.md          — Phase A 产出 PRD ⭐
4. docs/active/specs/<date>-<BATCH>-integration-checklist.md — Phase A 产出 checklist
5. docs/active/delivery/evidence/<BATCH>-ACCEPTANCE.md — 13 门禁骨架（你来填 ✅）
6. docs/active/decisions/ADR-<xxxx>.md              — 关联 ADR（PRD §0 列出）
7. docs/active/specs/2026-07-30-backend-production-readiness-design.md §10 强约束顺序
8. docs/active/governance/HARD-RULES-MATRIX.md      — 13 规则 × CI job 对位
9. contracts/openapi/services/<17 services>/       — operationId 来源
10. 已落地同主题 ACCEPTANCE.md                       — 范例（挑 1 个）

## 强约束顺序（必须严格遵守）

```
1. ADR（如需新决策）→ docs/active/decisions/ADR-NNNN-<slug>.md
2. contract → contracts/openapi/services/<svc>.yaml + bundled.yaml 重生成
3. failing tests → 先写 pytest 跑红
4. feature → 写实现让 test 跑绿
5. infrastructure → infra/helm/ + scripts/ci/
6. deploy 验证 → docker compose up / helm template
7. acceptance evidence → 填 <BATCH>-ACCEPTANCE.md 13 门禁 ✅
```

## 13 条硬规则（特别注意）

- **§3** 不允许裸 SQL；repository 必须有 tenant context
- **§4** 不允许裸 httpx；外部系统走 mate-clients/
- **§5** production profile 禁止 fake/mock/memory fallback
- **§6** ruff + pyright strict 0 error
- **§7** 不允许 @skip / pytest.skip / xfail（ga-007 卡死）
- **§10** 状态以 ACCEPTANCE.md 为准（ga-010 卡死）
- **§13** 每个 Python 服务都要有 NetworkPolicy 入口

完整 13 条见 `docs/active/governance/HARD-RULES-MATRIX.md`。

## 本地自检（push 前必跑）

```bash
# 1. pre-commit 全套（rules 3 / 4 / 5 / 7 / 10 / 12）
pip install pre-commit
pre-commit run --all-files

# 2. 单测
cd infra/tests && pytest -q
cd ../mate-platform-backend/packages/mate-platform && pytest -q
cd ../mate-app-kb && pytest -q

# 3. 5 个 forbid 脚本
python scripts/ci/forbid_raw_sql.py
python scripts/ci/forbid_bare_httpx.py
python scripts/ci/forbid_legacy_fallback.py
python scripts/ci/forbid_skip_tests.py
python scripts/ci/require_evidence.py

# 4. 静态
ruff check mate-platform-backend
pyright mate-platform-backend/packages/mate-platform/src \
        mate-platform-backend/packages/mate-clients/src

# 5. helm（如有 helm 变更）
cd infra/helm && helm-docs --dry-run --sort-values-order=file
for env in local staging production; do
  helm template metaplatform . -f values-$env.yaml | \
    kubeconform -strict -summary -ignore-missing-schemas -kubernetes-version 1.29.0 -
done
```

全部退出码 0 才允许 push。

## 填 <BATCH>-ACCEPTANCE.md

把骨架里的 ⬜ 全填 ✅：
- ga-001~013 每行贴 pytest 输出片段 / helm lint 输出 / commit SHA
- §1~7 checklist 每节贴具体命令 + 输出

## 提交风格（Conventional Commits）

```
<type>(<scope>): <subject>

<body 含 ADR 引用 + operationId 引用 + 关联 AC-*>

type ∈ feat / fix / refactor / docs / test / chore / ci / helm
```

## 启动方式

1. 切 worktree：
   `git worktree add .worktrees/<batch> codex/<batch>`
2. 跑 baseline 确认绿：
   `pre-commit run --all-files && pytest -q`（3 个包）
3. 按 §"强约束顺序" 1→7 推进
4. 每完成一阶段立即 commit；每 3~5 个 commit 跑一次本地自检
5. 全部完成后 push：
   `git push -u origin codex/<batch>`
6. 开 PR（gh pr create），标题 `<BATCH>: <一句话总结>`，正文贴：
   - 关联 ADR
   - 关联 PRD path
   - operationId 列表
   - ACCEPTANCE.md 链接
   - 自检命令 + 输出片段
7. 等 CI 绿 → ping Phase C Cowork 会话做验收对账

## 输出回执

会话结束前输出：
- worktree 路径
- PR 链接
- commit 列表（git log --oneline codex/main..HEAD）
- ACCEPTANCE.md 路径
- 接力给 Phase C 的关键字：BATCH ID + PR # + 关联 AC 列表
```

## 关联文档

- Phase A PRD 接力：`docs/active/specs/2026-08-20-ai-launch-prompt-cowork-prd.md`
- Phase C 验收接力：`docs/active/specs/2026-08-20-ai-launch-prompt-cowork-acceptance.md`
- 提交顺序母本：`docs/active/specs/2026-07-30-backend-production-readiness-design.md §10`
- 已落地范例：`docs/active/specs/2026-07-30-ai-launch-prompt-batchD-sec-iam-01.md`