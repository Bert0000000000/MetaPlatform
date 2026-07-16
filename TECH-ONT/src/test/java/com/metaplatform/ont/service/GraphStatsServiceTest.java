package com.metaplatform.ont.service;

import com.metaplatform.ont.dto.GraphStatsResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.neo4j.core.Neo4jClient;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.doReturn;

/**
 * P1-ONT-06 测试：图谱统计 API。
 * 使用 Mockito.spy 覆盖 executeQuery 方法，不连接真实 Neo4j。
 */
@ExtendWith(MockitoExtension.class)
class GraphStatsServiceTest {

    @Mock
    private Neo4jClient neo4jClient;

    private GraphStatsService graphStatsService;

    @BeforeEach
    void setUp() {
        graphStatsService = Mockito.spy(new GraphStatsService(neo4jClient));
    }

    @Test
    @SuppressWarnings("unchecked")
    void getStats_shouldReturnCorrectCounts() {
        List<Map<String, Object>> nodeStats = List.of(
                Map.of("nodeCount", 100L, "conceptCount", 10L, "entityCount", 90L)
        );
        List<Map<String, Object>> edgeStats = List.of(
                Map.of("edgeCount", 50L)
        );
        List<Map<String, Object>> typeStats = List.of(
                Map.of("type", "SUBSUMES", "count", 30L),
                Map.of("type", "RELATES_TO", "count", 20L)
        );

        doReturn(nodeStats).when(graphStatsService).executeQuery(contains("nodeCount"), anyMap());
        doReturn(edgeStats).when(graphStatsService).executeQuery(contains("edgeCount"), anyMap());
        doReturn(typeStats).when(graphStatsService).executeQuery(contains("relationTypeCode"), anyMap());

        GraphStatsResponse response = graphStatsService.getStats("tenant-1");

        assertThat(response.getNodeCount()).isEqualTo(100);
        assertThat(response.getEdgeCount()).isEqualTo(50);
        assertThat(response.getConceptCount()).isEqualTo(10);
        assertThat(response.getEntityCount()).isEqualTo(90);
        assertThat(response.getRelationTypes()).hasSize(2);
        assertThat(response.getRelationTypes().get(0).getType()).isEqualTo("SUBSUMES");
        assertThat(response.getRelationTypes().get(0).getCount()).isEqualTo(30);
        assertThat(response.getRelationTypes().get(1).getType()).isEqualTo("RELATES_TO");
        assertThat(response.getRelationTypes().get(1).getCount()).isEqualTo(20);
    }
}
