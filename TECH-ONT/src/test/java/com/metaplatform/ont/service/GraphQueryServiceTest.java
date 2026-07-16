package com.metaplatform.ont.service;

import com.metaplatform.ont.dto.GraphQueryRequest;
import com.metaplatform.ont.dto.GraphQueryResponse;
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
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.verify;

/**
 * P1-ONT-05 测试：知识图谱查询 API。
 * 使用 Mockito.spy 覆盖 executeQuery 方法，不连接真实 Neo4j。
 */
@ExtendWith(MockitoExtension.class)
class GraphQueryServiceTest {

    @Mock
    private Neo4jClient neo4jClient;

    private GraphQueryService graphQueryService;

    @BeforeEach
    void setUp() {
        graphQueryService = Mockito.spy(new GraphQueryService(neo4jClient));
    }

    @Test
    @SuppressWarnings("unchecked")
    void query_shouldReturnNodesAndEdges() {
        GraphQueryRequest request = new GraphQueryRequest();
        request.setStartNodeId("node-1");
        request.setDepth(2);

        List<Map<String, Object>> nodeRecords = List.of(
                Map.of("id", "node-1", "labels", List.of("Concept"), "properties", Map.of("code", "C1")),
                Map.of("id", "node-2", "labels", List.of("Entity"), "properties", Map.of("code", "E1"))
        );
        List<Map<String, Object>> edgeRecords = List.of(
                Map.of("id", "rel-1", "type", "RELATES_TO", "source", "node-1", "target", "node-2",
                        "properties", Map.of("relationTypeCode", "SUPPLIES_TO"))
        );

        doReturn(nodeRecords).when(graphQueryService).executeQuery(contains("UNWIND nodes"), anyMap());
        doReturn(edgeRecords).when(graphQueryService).executeQuery(contains("UNWIND relationships"), anyMap());

        GraphQueryResponse response = graphQueryService.query(request);

        assertThat(response.getNodes()).hasSize(2);
        assertThat(response.getNodes().get(0).getLabel()).isEqualTo("Concept");
        assertThat(response.getNodes().get(1).getLabel()).isEqualTo("Entity");
        assertThat(response.getEdges()).hasSize(1);
        assertThat(response.getEdges().get(0).getType()).isEqualTo("RELATES_TO");
        assertThat(response.getEdges().get(0).getSource()).isEqualTo("node-1");
        assertThat(response.getEdges().get(0).getTarget()).isEqualTo("node-2");
    }

    @Test
    void query_shouldIncludeRelationTypeFilter_whenRelationTypeProvided() {
        GraphQueryRequest request = new GraphQueryRequest();
        request.setStartNodeId("node-1");
        request.setDepth(1);
        request.setRelationType("SUPPLIES_TO");

        doReturn(List.of()).when(graphQueryService).executeQuery(anyString(), anyMap());

        graphQueryService.query(request);

        org.mockito.ArgumentCaptor<String> cypherCaptor = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(graphQueryService, org.mockito.Mockito.atLeast(1)).executeQuery(cypherCaptor.capture(), anyMap());

        assertThat(cypherCaptor.getValue()).contains("relationTypeCode");
        assertThat(cypherCaptor.getValue()).contains("$relationType");
    }
}
