#!/usr/bin/env bash
# 初始化新 Batch（创建分支 + worktree）
# Usage: ./new-batch.sh MP-V6-FOUNDATION-01

set -euo pipefail

BATCH="${1:?Usage: $0 MP-V6-BATCH-NN}"

if [ -z "$BATCH" ]; then
  echo "Usage: $0 MP-V6-BATCH-NN"
  exit 1
fi

BRANCH="feat/$(echo "$BATCH" | tr '[:upper:]' '[:lower:]')"
DOC_PATH="docs/active/batch/${BATCH}.md"

echo "🎯 Initializing Batch: $BATCH"
echo "🌿 Branch: $BRANCH"

# 检查分支是否已存在
if git rev-parse --verify "$BRANCH" >/dev/null 2>&1; then
  echo "❌ Branch $BRANCH already exists"
  exit 1
fi

# 检查文档是否存在
if [ ! -f "$DOC_PATH" ]; then
  echo "❌ Doc $DOC_PATH not found"
  echo "请先创建 Batch 任务文档"
  exit 1
fi

# 切到 main
git checkout main
git pull origin main

# 创建新分支
git checkout -b "$BRANCH"

# 复制 Batch 文档到工作目录（方便 Claude Code 读取）
cp "$DOC_PATH" ".claude/current-batch.md"

# 初始化 evidence 目录
mkdir -p "evidence"
if [ ! -f "evidence/${BATCH}-ACCEPTANCE.md" ]; then
  cat > "evidence/${BATCH}-ACCEPTANCE.md" <<EOF
# ${BATCH} - ACCEPTANCE

> **状态**：Pending Acceptance
> **关联 Batch**：${BATCH}
> **关联 spec**：[链接到 spec]

## 验收标准

<!-- 复制 Batch 文档中的 AC 列表，每项勾选 -->

## 测试结果

<!-- 单元测试 / 集成测试 / e2e 测试结果 -->

## 部署验证

<!-- staging / dev 环境部署截图 -->

## 评审 checklist

- [ ] spec 一致性
- [ ] RLS / 多租户隔离
- [ ] OTel trace 完整
- [ ] Secret 不进 git
EOF
  echo "📝 初始化 evidence/${BATCH}-ACCEPTANCE.md"
fi

echo ""
echo "✅ Batch 初始化完成"
echo ""
echo "下一步："
echo "  1. 阅读 docs/active/batch/${BATCH}.md 任务清单"
echo "  2. 开始实现（按周拆分）"
echo "  3. 写测试 + 跑测试"
echo "  4. 写 evidence/${BATCH}-ACCEPTANCE.md"
echo "  5. commit + push + 创建 PR"
echo ""
echo "或运行 Claude Code loop:"
echo "  claude --loop .claude/loop-prompt.md --batch ${BATCH}"