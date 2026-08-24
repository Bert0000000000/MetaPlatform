#!/usr/bin/env bash
# 找下一个未完成的 Batch（evidence 文件不存在 = 未完成）
# Usage: ./next-batch.sh

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

echo "🔍 扫描 Batch 状态..."

# 列出所有 batch 文档
BATCH_DIR="docs/active/batch"
ALL_BATCHES=$(ls -1 "$BATCH_DIR"/*.md 2>/dev/null | xargs -n1 basename | sed 's/.md$//' | sort)

NEXT_BATCH=""

for BATCH in $ALL_BATCHES; do
  # 检查 evidence 文件是否存在
  EVIDENCE="evidence/${BATCH}-ACCEPTANCE.md"
  if [ ! -f "$EVIDENCE" ]; then
    NEXT_BATCH="$BATCH"
    echo "📋 找到下一个未完成 Batch: $BATCH"
    break
  else
    echo "  ✅ ${BATCH} - 已完成"
  fi
done

if [ -z "$NEXT_BATCH" ]; then
  echo "🎉 所有 Batch 已完成"
  exit 1
fi

echo ""
echo "✅ Next Batch: $NEXT_BATCH"
echo "📁 Evidence: evidence/${NEXT_BATCH}-ACCEPTANCE.md"
echo "📋 Doc: ${BATCH_DIR}/${NEXT_BATCH}.md"

# 输出（供 Claude Code 捕获）
echo "$NEXT_BATCH"