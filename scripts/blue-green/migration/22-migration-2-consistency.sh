#!/usr/bin/env bash
# ST-7.4.3: 迁移 #2 — 数据一致性校验
# 对照 Neo4j 实例数、关系数、向量数
set -euo pipefail

NEO4J_OLD="bolt://neo4j-old:7687"
NEO4J_NEW="bolt://neo4j-new:7687"

echo "==> 对比 Neo4j 实例数"
OLD_COUNT=$(cypher-shell -a "$NEO4J_OLD" "MATCH (n) RETURN count(n) AS c" | tail -1 | awk '{print $2}')
NEW_COUNT=$(cypher-shell -a "$NEO4J_NEW" "MATCH (n) RETURN count(n) AS c" | tail -1 | awk '{print $2}')

echo "  v_old: $OLD_COUNT  /  v_new: $NEW_COUNT"
DIFF_PCT=$(echo "scale=4; ($NEW_COUNT - $OLD_COUNT) / $OLD_COUNT * 100" | bc -l | sed 's/-//')
echo "  差异: ${DIFF_PCT}% (目标 < 0.01%)"

# 关系数
OLD_REL=$(cypher-shell -a "$NEO4J_OLD" "MATCH ()-[r]->() RETURN count(r) AS c" | tail -1 | awk '{print $2}')
NEW_REL=$(cypher-shell -a "$NEO4J_NEW" "MATCH ()-[r]->() RETURN count(r) AS c" | tail -1 | awk '{print $2}')

echo "  关系 v_old: $OLD_REL / v_new: $NEW_REL"

if (( $(echo "$DIFF_PCT > 0.01" | bc -l) )); then
    echo "==> 差异超阈值！回滚"
    bash "$(dirname "$0")/../05-weight-switch.sh" tech-ont 0
    bash "$(dirname "$0")/../05-weight-switch.sh" tech-llmgw 0
    exit 1
fi