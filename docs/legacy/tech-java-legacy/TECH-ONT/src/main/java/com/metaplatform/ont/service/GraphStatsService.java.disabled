package com.metaplatform.ont.service;

import com.metaplatform.ont.dto.GraphStatsResponse;
import com.metaplatform.ont.dto.RelationTypeCount;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.List;
import java.util.Map;

/**
 * 图谱统计服务（P1-ONT-06）。
 * 使用 Neo4j Cypher 聚合查询统计节点数、边数、概念数、实体数和关系类型分布。
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class GraphStatsService {

    private final Neo4jClient neo4jClient;

    public GraphStatsResponse getStats(String tenantId) {
        String nodeStatsCypher =
                "MATCH (n) WHERE n.tenantId = $tenantId " +
                "RETURN count(n) as nodeCount, " +
                "count(CASE WHEN 'Concept' IN labels(n) THEN n END) as conceptCount, " +
                "count(CASE WHEN 'Entity' IN labels(n) THEN n END) as entityCount";

        Collection<Map<String, Object>> nodeStats = executeQuery(nodeStatsCypher, Map.of("tenantId", tenantId));

        long nodeCount = 0;
        long conceptCount = 0;
        long entityCount = 0;
        if (!nodeStats.isEmpty()) {
            Map<String, Object> first = nodeStats.iterator().next();
            nodeCount = toLong(first.get("nodeCount"));
            conceptCount = toLong(first.get("conceptCount"));
            entityCount = toLong(first.get("entityCount"));
        }

        String edgeCountCypher =
                "MATCH ()-[r]->() WHERE r.tenantId = $tenantId " +
                "RETURN count(r) as edgeCount";

        Collection<Map<String, Object>> edgeStats = executeQuery(edgeCountCypher, Map.of("tenantId", tenantId));
        long edgeCount = 0;
        if (!edgeStats.isEmpty()) {
            edgeCount = toLong(edgeStats.iterator().next().get("edgeCount"));
        }

        String relationTypeCypher =
                "MATCH ()-[r]->() WHERE r.tenantId = $tenantId " +
                "RETURN r.relationTypeCode as type, count(r) as count";

        Collection<Map<String, Object>> typeStats = executeQuery(relationTypeCypher, Map.of("tenantId", tenantId));
        List<RelationTypeCount> relationTypes = typeStats.stream()
                .map(record -> RelationTypeCount.builder()
                        .type(String.valueOf(record.get("type")))
                        .count(toLong(record.get("count")))
                        .build())
                .toList();

        return GraphStatsResponse.builder()
                .nodeCount(nodeCount)
                .edgeCount(edgeCount)
                .conceptCount(conceptCount)
                .entityCount(entityCount)
                .relationTypes(relationTypes)
                .build();
    }

    @SuppressWarnings("unchecked")
    protected Collection<Map<String, Object>> executeQuery(String cypher, Map<String, Object> params) {
        return neo4jClient.query(cypher).bindAll(params).fetch().all();
    }

    private long toLong(Object value) {
        if (value == null) return 0L;
        if (value instanceof Number n) return n.longValue();
        return 0L;
    }
}
