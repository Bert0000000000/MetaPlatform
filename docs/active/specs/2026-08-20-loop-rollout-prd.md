# LOOP-ROLLOUT-01 · PRD

## §0 背景 & 目标

落地 ADR-0044 决策：双轨分支（`cowork/**` + `codex/**`）+ 三阶段 Loop（Cowork PRD → Code → Cowork Acceptance）。**本批次是 loop 自身的第一次实战**，所有产物必须能被后续 BATCH 直接复用。

- 关联 ADR：ADR-0044（主）、ADR-0043（范式同源）、HARD-RULES-MATRIX（13 门禁基线）
- 关联 operationId：无（不触达 API）
- 关联 PRD：本文即本 BATCH 的 PRD

## §1 范围

- 3 份 ai-launch prompt 模板（已落地）
- 本 PRD 模板（即本文件）
- 1 份 integration-checklist 模板
- 1 份 ACCEPTANCE.md 骨架模板
- 1 个轻量 CI：`.github/workflows/cowork-prd-ci.yml`
- 1 个校验脚本：`scripts/ci/check_prd_skeleton.py`
- 1 个 ADR：ADR-0044

**非范围**：不修改 ga-acceptance.yml；不修复 4 项 🟡 硬规则；不解决 FOLLOW-UP-BOARD 67 个未收口。

## §2 功能需求

- **FR-1** [P0] 三个 ai-launch prompt 模板落地（cowork-prd / code-batch / cowork-acceptance）。验证：文件存在 + 格式与 `2026-07-30-ai-launch-prompt-batchD` 同源。关联 ADR-0044。
- **FR-2** [P0] `.github/workflows/cowork-prd-ci.yml` 仅在 PR 到 main（paths 限定 `docs/active/specs/**` + `docs/active/delivery/evidence/**` + workflow 自身 + 校验脚本）和 push 到 `cowork/**` 时触发。验证：`grep -c "branches: \[main\]" cowork-prd-ci.yml` ≥1 且 `grep -c "branches: \[cowork" cowork-prd-ci.yml` ≥1。关联 ADR-0044。
- **FR-3** [P0] `scripts/ci/check_prd_skeleton.py` 校验 PRD 文件的 §0~§6 节、FR / AC / NFR 编号、ADR 引用；ACCEPTANCE.md 的 13 个 ga-* 字段、证据 / 命令 / commit 三栏。验证：sample PRD 退出码 0，破坏版退出码 1（`--strict` 模式）。关联 ADR-0044。
- **FR-4** [P0] ADR-0044 记录双轨分支 + 三阶段 Loop 决策。验证：`test -f docs/active/decisions/ADR-0044-cowork-code-loop-rollout.md` 退出码 0。关联 ADR-0044。
- **FR-5** [P1] `docs/active/delivery/evidence/LOOP-ROLLOUT-01-ACCEPTANCE.md` 13 行齐全，ga-010 与 ga-012 由 require_evidence + gitleaks 在 PR 上自动验证。关联 ADR-0044。
- **FR-6** [P2] `PROGRAM-BOARD.md` 追加 LOOP-ROLLOUT-01 行（Phase B 完成后）。验证：`grep "LOOP-ROLLOUT-01" PROGRAM-BOARD.md` 命中。关联 ADR-0044。

## §3 非功能需求

- **NFR-1** cowork-prd-ci.yml 跑完时间 ≤ 3 分钟（只跑 markdown lint + 1 个 Python 脚本）。
- **NFR-2** check_prd_skeleton.py 仅依赖 Python 标准库（不引第三方）。
- **NFR-3** ai-launch prompt 与现有 `2026-07-30-ai-launch-prompt-batchD` 同结构，便于新会话复用。

## §4 验收标准

- **AC-1** 三个 ai-launch prompt 文件存在。验证：`ls -1 docs/active/specs/2026-08-20-ai-launch-prompt-*.md | wc -l` 输出 3。
- **AC-2** cowork-prd-ci.yml 通过 YAML lint 且路径过滤正确。验证：`python -c "import yaml; yaml.safe_load(open('.github/workflows/cowork-prd-ci.yml'))"` 退出码 0；`grep -c "branches: \[main\]" .github/workflows/cowork-prd-ci.yml` ≥1；`grep -c 'branches: \["cowork/\*\*"\]' .github/workflows/cowork-prd-ci.yml` ≥1。
- **AC-3** check_prd_skeleton.py 在样本 PRD 上退出码 0，破坏版退出码 1。验证：构造 sample PRD（含全部 7 节 + FR / AC / NFR / ADR 编号）和 sample ACCEPTANCE（含 13 个 ga-* + 三栏），跑脚本退出码 0；故意删除 §4 节再跑退出码 1。
- **AC-4** ADR-0044 文件存在且含关键字段。验证：`test -f docs/active/decisions/ADR-0044-cowork-code-loop-rollout.md` 退出码 0；`grep -c "分支策略" docs/active/decisions/ADR-0044-cowork-code-loop-rollout.md` ≥1。
- **AC-5** cowork-prd-ci.yml 在 PR 上跑出 md-lint + prd-skeleton 两个 job 全绿。验证：PR Actions 标签 ✅ ×2。
- **AC-6** ga-012 gitleaks 在 PR 上 0 leak。验证：`gitleaks detect --no-banner` 退出码 0。

## §5 依赖

- 无前置 BATCH
- 依赖 ADR-0043（范式同源）
- 依赖 HARD-RULES-MATRIX（13 门禁不变）
- 依赖 Python 3.12（CI 已用）

## §6 风险与未决

- **风险 1**：cowork-prd-ci.yml 的 path filter 太宽，可能误触发 → 缓解：用 `paths` 严格限定 `docs/active/specs` + `docs/active/delivery/evidence` + workflow / 脚本自身。
- **风险 2**：check_prd_skeleton.py 的「§0-§6 节」定义与未来 PRD 模板不一致 → 缓解：把本 PRD 作为骨架模板，后续 BATCH 必须以此为参照。
- **风险 3**：ADR-0044 占用一个 ADR 编号 → 缓解：和 ADR-0043 同源，可考虑合并；目前保留以明示治理节点。
- **未决 1**：第二阶段 BATCH 选哪个？建议 FOLLOW-UP-BOARD A 组里某个 OpenAPI parity fix（最小）。