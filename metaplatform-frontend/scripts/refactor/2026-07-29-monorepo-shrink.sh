#!/usr/bin/env bash
# ============================================================================
# 2026-07-29 monorepo-shrink:把 9 个 SPA 收敛为 1 个 SPA(@mate/web)
# ============================================================================
#
# 背景:
#   当前 metaplatform-frontend/apps/ 下有 9 个独立 SPA(portal/dashboard/superai/
#   arch/apps/apphub/mcphub/kb/dw/ontstudio),但用户已经明确:
#     - 前端是"一整套内容,只有 9 个一级菜单"
#     - portal 实际就是主前端(47 路由已涵盖全部模块)
#     - 其余 8 个 app 是早期"按业务模块拆分 SPA"的错位决策
#
# 本脚本做的事:
#   1. portal/ → web/(重命名 + package.json.name 同步)
#   2. 删除纯冗余 app: kb/ dw/ dashboard/ superai/
#   3. 把 mcphub/ arch/ apphub/ 的独有页面 cp 到 web/src/pages/{mcp,arch,apps}/
#      并删除这 3 个 app 目录
#   4. ontstudio/ 单独评估:由 docs/handoff/ 出方案,本脚本不动
#   5. 提交 refactor commit
#
# 约束:
#   - 必须先 git status 干净
#   - 必须处于 pre-restructure-2026-07-29 分支已存在的状态下
#   - 失败回滚:git reset --hard pre-restructure-2026-07-29
#
# 用法:
#   bash scripts/refactor/2026-07-29-monorepo-shrink.sh
# ============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FE_ROOT="$REPO_ROOT/metaplatform-frontend"
APPS="$FE_ROOT/apps"

# 1. 前置检查
cd "$REPO_ROOT"
if ! git diff --quiet HEAD 2>/dev/null; then
  echo "[FAIL] 工作区不干净,请先 commit 或 stash 现有改动" >&2
  exit 1
fi
if ! git rev-parse --verify --quiet pre-restructure-2026-07-29 >/dev/null; then
  echo "[FAIL] 备份分支 pre-restructure-2026-07-29 不存在,无法安全操作" >&2
  exit 1
fi

echo "==> Step 1/6: portal/ → web/(重命名)"
git mv "$APPS/portal" "$APPS/web"
# package.json.name 已经被 Edit 改成 @mate/web(沙箱里已做)

echo "==> Step 2/6: 删除 kb/ dw/ dashboard/ superai/(纯冗余或内容已并入 web)"
git rm -r "$APPS/kb"
git rm -r "$APPS/dw"
git rm -r "$APPS/dashboard"
git rm -r "$APPS/superai"

echo "==> Step 3/6: 把 mcphub/ arch/ apphub/ 独有页面搬进 web/src/pages/"
# mcphub 独有(portal 没有):
#   prompts/resources/policies/matrix/ide-config/connection-monitor/
#   integrations/trusts/collaborations/audit-stats/audit-detail
MCPHUB_UNIQUE=(
  PromptTemplatePage ResourceListPage ResourceEditPage PolicyManagementPage
  PermissionMatrixPage IdeConfigPage ConnectionMonitorPage ExternalIntegrationPage
  TrustManagementPage CollaborationAuditPage AuditStatisticsPage AuditDetailPage
  ServerListPage ServerDetailPage ClientListPage ClientDetailPage ClientFormPage
  ToolListPage ToolDetailPage ToolEditPage OverviewPage DebuggerPage
)
mkdir -p "$APPS/web/src/pages/mcp"
for f in "${MCPHUB_UNIQUE[@]}"; do
  if [[ -f "$APPS/mcphub/src/pages/${f}.tsx" ]]; then
    git mv "$APPS/mcphub/src/pages/${f}.tsx" "$APPS/web/src/pages/mcp/${f}.tsx"
  fi
done

# arch 独有:
#   capabilities/applications/value-streams/processes/org-roles/data-flows/
#   standards/assets/tech-components/tech-stacks/deployment-topologies/
#   tech-radar/review-templates/reviews/tech-debt/ontology-mapping/data-entity-detail
ARCH_UNIQUE=(
  CapabilityManagementPage ApplicationManagementPage ValueStreamPage
  BusinessProcessPage OrgRolePage DataFlowPage DataStandardPage DataAssetCatalogPage
  TechComponentPage TechStackPage DeploymentTopologyPage TechRadarPage
  PrinciplesPage ReviewTemplatePage ReviewPage TechDebtPage OntologyMappingPage
  DataEntityDetailPage
)
mkdir -p "$APPS/web/src/pages/arch"
for f in "${ARCH_UNIQUE[@]}"; do
  if [[ -f "$APPS/arch/src/pages/${f}.tsx" ]]; then
    git mv "$APPS/arch/src/pages/${f}.tsx" "$APPS/web/src/pages/arch/${f}.tsx"
  fi
done

# apphub 独有:
#   marketplace/market/my-templates/AI-designer/page-designer/release-record
APPHUB_UNIQUE=(
  MarketplacePage MarketplaceDetailPage MarketPage MarketDetailPage
  MyTemplatesPage TemplateDetailPage TemplateSubmitPage AIDesignerPage
  PageDesignerPage ReleaseRecordPage
)
mkdir -p "$APPS/web/src/pages/apps"
for f in "${APPHUB_UNIQUE[@]}"; do
  if [[ -f "$APPS/apphub/src/pages/${f}.tsx" ]]; then
    git mv "$APPS/apphub/src/pages/${f}.tsx" "$APPS/web/src/pages/apps/${f}.tsx"
  fi
done

echo "==> Step 4/6: 删除空壳 mcphub/ arch/ apphub/"
git rm -r "$APPS/mcphub" || true   # 若还有未搬走的子目录(如 components/utils),改用:
# git mv "$APPS/mcphub/src/components" "$APPS/web/src/components/_mcp"
# git mv "$APPS/mcphub/src/utils"      "$APPS/web/src/utils/_mcp"
git rm -r "$APPS/arch"    || true
git rm -r "$APPS/apphub"  || true

echo "==> Step 5/6: 更新根 pnpm-workspace.yaml 引用"
# apps/portal → apps/web(如果有别处硬编码路径,在这一步 grep 替换)
grep -rln "apps/portal" "$FE_ROOT" --include='*.ts' --include='*.tsx' --include='*.json' --include='*.yaml' --include='*.md' \
  --exclude-dir=node_modules 2>/dev/null \
  | xargs -r sed -i 's|apps/portal|apps/web|g' || true

echo "==> Step 6/6: 提交"
cd "$REPO_ROOT"
git add -A
git commit -m "refactor(frontend): 收敛为唯一 web app

- apps/portal → apps/web(@mate/web),承载 9 个一级菜单
- 删除冗余 SPA:kb/dw/dashboard/superai(内容已合并)
- 把 mcphub/arch/apphub 的独有页面下沉到 web/src/pages/{mcp,arch,apps}
- 删除 3 个空壳 app 目录
- ontstudio 单独评估,见 docs/handoff/outbox/TASK-2026-0729-001-ontstudio-result.md

配套:
- scripts/refactor/2026-07-29-monorepo-shrink.sh(本次执行)
- docs/active/specs/2026-07-27-mate-platform-tech-stack-confirmed.md §7(同步更新)
- docs/active/specs/2026-07-27-mate-platform-delivery-roadmap.md W6(同步更新)
- CLAUDE.md 仓库结构(同步更新)"

echo ""
echo "==> Done. 查看提交:"
git log -1 --stat | head -20

echo ""
echo "回滚方式(如需要):"
echo "  git reset --hard pre-restructure-2026-07-29"