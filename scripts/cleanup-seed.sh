#!/usr/bin/env bash
# =============================================================================
# GOVERN-11 cleanup-seed.sh — 清理 7+1 数字员工 seed（不污染其他 dev）
# -----------------------------------------------------------------------------
# 逆序删除 ont_individual / ont_action_type / ont_function / ont_object_type /
# ont_link_type / ont_interface 中由 seed_hr_it_finance_orchestrator 注入的
# rid 前缀为 ont.tenant-default.ind.dw-* / .superai-* / .act.dw-* /
# .fn.dw-* / .act.superai-* / .fn.superai-* 的行。
# =============================================================================
set -uo pipefail

PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-meta}"
PGPASSWORD="${PGPASSWORD:-mate-pass}"
PGDATABASE="${PGDATABASE:-metaplatform_ont}"
TENANT="${TENANT:-tenant-default}"
export PGPASSWORD

TABLES_RAW=(
  "ont_axiom"
  "ont_link_instance"
  "ont_link_type"
  "ont_individual"
  "ont_action_type"
  "ont_function"
  "ont_object_type"
  "ont_property"
  "ont_interface"
)
PATTERNS=(
  "ont.${TENANT}.ind.dw-%"
  "ont.${TENANT}.ind.superai-%"
  "ont.${TENANT}.act.dw-%"
  "ont.${TENANT}.act.superai-%"
  "ont.${TENANT}.fn.dw-%"
  "ont.${TENANT}.fn.superai-%"
  "ont.${TENANT}.link.dw-%"
  "ont.${TENANT}.if.dw-employee%"
  "ont.${TENANT}.obj.dw-digital-employee%"
  "ont.${TENANT}.obj.superai%"
  "ont.${TENANT}.prop.dw-%"
  "ont.${TENANT}.prop.superai-%"
)

echo "[GOVERN-11] cleanup tenant=${TENANT} db=${PGDATABASE}"

for table in "${TABLES_RAW[@]}"; do
  for pat in "${PATTERNS[@]}"; do
    cnt=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -tAc \
      "SELECT count(*) FROM ${table} WHERE rid LIKE '${pat}' AND tenant_id='${TENANT}'" \
      2>/dev/null || echo 0)
    if [[ "$cnt" -gt 0 ]]; then
      echo "  DELETE ${table} WHERE rid LIKE '${pat}' (${cnt} rows)"
      psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -c \
        "DELETE FROM ${table} WHERE rid LIKE '${pat}' AND tenant_id='${TENANT}'" \
        >/dev/null 2>&1 || true
    fi
  done
done

echo "[GOVERN-11] cleanup done"
