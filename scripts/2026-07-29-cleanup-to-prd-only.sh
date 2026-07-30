#!/usr/bin/env bash
# ============================================================================
# 2026-07-29-cleanup-to-prd-only.sh
# ----------------------------------------------------------------------------
# 重设计前的仓库清理:仅保留 PRD / CLAUDE.md / 设计规范,其它全清。
#
# 保留清单(白名单):
#   - CLAUDE.md                                  (项目指令,根)
#   - docs/active/prd/                           (PRD,8 个 APP 子目录 + _top)
#   - metaplatform-design-draft/                 (设计规范,53 HTML mockup + design 源文件)
#
# 删除清单(其他一切):
#   - 应用代码:metaplatform-frontend/ apps/ mate-platform-backend/ services/
#   - 文档:docs/active/{api,legal,plans,reports,reviews,runbooks,scenarios,security,specs,user-manual}/
#           docs/legacy/ docs/migration/ docs/superpowers/ docs/handoff/ docs/README.md
#   - 测试:acceptance/ tests/
#   - 基础设施:infra/ legacy/ docker-compose*.yml Dockerfile.orig
#   - 启动脚本:scripts/(包括本脚本所在的 scripts/ 目录——本脚本必须自删除前完成)
#   - 配置:.env .env.example .dockerignore .pre-commit-config.yaml
#   - 包管理:package.json package-lock.json pnpm-workspace.yaml pnpm-lock.yaml pyproject.toml ruff.toml uv.lock
#   - 各种 dev 日志/构建产物:*.log build-logs/ .pytest_cache .ruff_cache .venv .vscode .claude .superpowers
#   - agent.md README.md PROFILES.md start-*.ps1 build-*.bat build-*.ps1
#
# 安全策略:
#   1. 预先 dry-run(默认行为)打印将删除的路径,要求 --yes 才执行
#   2. 执行前创建 backup-pre-cleanup-<timestamp>.tar.gz 整库快照
#   3. 出错自动回滚到该 tar
#   4. 删除前不删 .git(保留 git 历史)
#
# 用法:
#   bash scripts/2026-07-29-cleanup-to-prd-only.sh           # dry-run
#   bash scripts/2026-07-29-cleanup-to-prd-only.sh --yes     # 真删
#   bash scripts/2026-07-29-cleanup-to-prd-only.sh --restore # 从 backup 还原
# ============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
KEEP=("CLAUDE.md" "docs/active/prd" "metaplatform-design-draft")
TS="$(date +%Y%m%d-%H%M%S)"
BACKUP="$REPO_ROOT/../backup-pre-cleanup-$TS.tar.gz"

MODE="${1:-dry}"
case "$MODE" in
  --yes|-y)    MODE="apply" ;;
  --restore)   MODE="restore" ;;
  --dry|"")    MODE="dry" ;;
  *) echo "用法: $0 [--dry|--yes|--restore]"; exit 1 ;;
esac

# -------- restore 模式:从最新备份还原 --------
if [[ "$MODE" == "restore" ]]; then
  LATEST="$(ls -t "$REPO_ROOT/../backup-pre-cleanup-"*.tar.gz 2>/dev/null | head -1 || true)"
  if [[ -z "$LATEST" ]]; then
    echo "[FAIL] 找不到 backup-pre-cleanup-*.tar.gz"; exit 1
  fi
  echo "[restore] 从 $LATEST 还原到 $REPO_ROOT ..."
  tar -xzf "$LATEST" -C "$(dirname "$REPO_ROOT")"
  echo "[done] 还原完成"
  exit 0
fi

# -------- 路径工具 --------
is_keep() {
  local p="$1"
  for k in "${KEEP[@]}"; do
    if [[ "$p" == "$k" || "$p" == "$k/"* ]]; then return 0; fi
  done
  return 1
}

# -------- dry-run / apply 共用:计算删除清单 --------
echo "==> 扫描 $REPO_ROOT ..."
TO_DELETE=()
while IFS= read -r -d '' entry; do
  rel="${entry#$REPO_ROOT/}"
  if is_keep "$rel"; then continue; fi
  # 永远保留 .git
  if [[ "$rel" == ".git" || "$rel" == .git/* ]]; then continue; fi
  TO_DELETE+=("$rel")
done < <(find "$REPO_ROOT" -mindepth 1 -maxdepth 1 -print0 | sort -z)

# 也清理仓库根直接挂的 *.log / *.bak / 杂项文件(白名单外的)
shopt -s nullglob dotglob
for f in "$REPO_ROOT"/*; do
  [[ -d "$f" && "$(basename "$f")" == ".git" ]] && continue
  rel="$(basename "$f")"
  is_keep "$rel" && continue
  # 已在 TO_DELETE 里(顶层目录/文件)
  case " ${TO_DELETE[*]} " in *" $rel "*) continue;; esac
  TO_DELETE+=("$rel")
done
shopt -u nullglob dotglob

echo "==> 保留清单(${#KEEP[@]} 项):"
printf "    - %s\n" "${KEEP[@]}"
echo ""
echo "==> 删除清单(${#TO_DELETE[@]} 项):"
for d in "${TO_DELETE[@]}"; do echo "    - $d"; done

# -------- dry-run --------
if [[ "$MODE" == "dry" ]]; then
  echo ""
  echo "[dry-run] 未做任何修改。要执行删除,运行: $0 --yes"
  exit 0
fi

# -------- apply --------
echo ""
echo "[apply] 创建整库快照到 $BACKUP ..."
tar -czf "$BACKUP" -C "$(dirname "$REPO_ROOT")" "$(basename "$REPO_ROOT")" 2>&1 | tail -3

echo "[apply] 执行删除 ..."
cd "$REPO_ROOT"
for d in "${TO_DELETE[@]}"; do
  if [[ -e "$d" ]]; then
    rm -rf "$d"
    echo "    [rm] $d"
  fi
done

# 自删除本脚本
rm -f "$REPO_ROOT/scripts/2026-07-29-cleanup-to-prd-only.sh"

echo ""
echo "[done] 仓库已清理。剩余结构:"
ls -la "$REPO_ROOT"
echo ""
echo "回滚方式(如需要):"
echo "  bash <备份目录>/restore.sh  或  tar -xzf $BACKUP -C $(dirname "$REPO_ROOT")"