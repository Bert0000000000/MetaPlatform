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
 * V12-01 测试：知识图谱查询 API。
 * 覆盖 startNodeId 起始、query 关键字起始、节点类型筛选、relationType 过滤、expand 节点展开。
 * 使用 Mockito.spy 覆盖 executeQuery / resolveStartNodeIds 方法，不连接真实 Neo4j。
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
    void query_byStartNodeId_shouldReturnNodesAndEdges() {
        GraphQueryRequest request = new GraphQueryRequest();
        request.setStartNodeId("node-1");
        request.setDepth(2);

        List<Map<String, Object>> nodeRecords = List.of(
                Map.of("id", "node-1", "labels", List.of("Concept"), "properties", Map.of("name", "客户", "code", "C1")),
                Map.of("id", "node-2", "labels", List.of("Entity"), "properties", Map.of("name", "北京华夏", "code", "E1"))
        );
        List<Map<String, Object>> edgeRecords = List.of(
                Map.of("id", "rel-1", "type", "RELATES_TO", "source", "node-1", "target", "node-2",
                        "properties", Map.of("relationTypeCode", "SUPPLIES_TO"))
        );

        doReturn(List.of("node-1")).when(graphQueryService).resolveStartNodeIds(eq("node-1"), isNull());
        doReturn(nodeRecords).when(graphQueryService).executeQuery(contains("UNWIND nodes"), anyMap());
        doReturn(edgeRecords).when(graphQueryService).executeQuery(contains("UNWIND relationships"), anyMap());

        GraphQueryResponse response = graphQueryService.query(request);

        assertThat(response.getNodes()).hasSize(2);
        assertThat(response.getNodes().get(0).getLabel()).isEqualTo("客户");
        assertThat(response.getNodes().get(0).getType()).isEqualTo("concept");
        assertThat(response.getNodes().get(1).getType()).isEqualTo("entity");
        assertThat(response.getEdges()).hasSize(1);
        assertThat(response.getEdges().get(0).getType()).isEqualTo("RELATES_TO");
        assertThat(response.getEdges().get(0).getLabel()).isEqualTo("SUPPLIES_TO");
        assertThat(response.getEdges().get(0).getSource()).isEqualTo("node-1");
        assertThat(response.getEdges().get(0).getTarget()).isEqualTo("node-2");
    }

    @Test
    void query_byKeyword_shouldResolveStartNodesViaCypher() {
        GraphQueryRequest request = new GraphQueryRequest();
        request.setQuery("客户");
        request.setDepth(1);

        doReturn(List.of("node-1", "node-2")).when(graphQueryService)
                .resolveStartNodeIds(isNull(), eq("客户"));
        doReturn(List.of()).when(graphQueryService).executeQuery(anyString(), anyMap());

        graphQueryService.query(request);

        // 验证 resolveStartNodeIds 被调用
        verify(graphQueryService).resolveStartNodeIds(isNull(), eq("客户"));
    }

    @Test
    void query_shouldFilterByNodeTypes() {
        GraphQueryRequest request = new GraphQueryRequest();
        request.setStartNodeId("node-1");
        request.setDepth(2);
        request.setNodeTypes(List.of("concept"));

        List<Map<String, Object>> nodeRecords = List.of(
                Map.of("id", "node-1", "labels", List.of("Concept"), "properties", Map.of("name", "客户")),
                Map.of("id", "node-2", "labels", List.of("Entity"), "properties", Map.of("name", "实例"))
        );

        doReturn(List.of("node-1")).when(graphQueryService).resolveStartNodeIds(eq("node-1"), isNull());
        doReturn(nodeRecords).when(graphQueryService).executeQuery(contains("UNWIND nodes"), anyMap());
        doReturn(List.of()).when(graphQueryService).executeQuery(contains("UNWIND relationships"), anyMap());

        GraphQueryResponse response = graphQueryService.query(request);

        // 只返回 concept 节点，entity 节点被过滤
        assertThat(response.getNodes()).hasSize(1);
        assertThat(response.getNodes().get(0).getType()).isEqualTo("concept");
    }

    @Test
    void query_shouldIncludeRelationTypeFilter_whenRelationTypeProvided() {
        GraphQueryRequest request = new GraphQueryRequest();
        request.setStartNodeId("node-1");
        request.setDepth(1);
        request.setRelationType("SUPPLIES_TO");

        doReturn(List.of("node-1")).when(graphQueryService).resolveStartNodeIds(eq("node-1"), isNull());
        doReturn(List.of()).when(graphQueryService).executeQuery(anyString(), anyMap());

        graphQueryService.query(request);

        org.mockito.ArgumentCaptor<String> cypherCaptor = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(graphQueryService, org.mockito.Mockito.atLeast(1)).executeQuery(cypherCaptor.capture(), anyMap());

        assertThat(cypherCaptor.getValue()).contains("relationTypeCode");
        assertThat(cypherCaptor.getValue()).contains("$relationType");
    }

    @Test
    void query_emptyStartNodes_shouldReturnEmptyResponse() {
        GraphQueryRequest request = new GraphQueryRequest();
        request.setQuery("不存在的关键字");

        doReturn(List.of()).when(graphQueryService).resolveStartNodeIds(isNull(), eq("不存在的关键字"));

        GraphQueryResponse response = graphQueryService.query(request);

        assertThat(response.getNodes()).isEmpty();
        assertThat(response.getEdges()).isEmpty();
    }

    @Test
    void expand_shouldQueryByNodeIdWithDepth() {
        doReturn(List.of("node-X")).when(graphQueryService).resolveStartNodeIds(eq("node-X"), isNull());
        doReturn(List.of(
                Map.of("id", "node-X", "labels", List.of("Concept"), "properties", Map.of("name", "中心节点")),
                Map.of("id", "neighbor-1", "labels", List.of("Entity"), "properties", Map.of("name", "邻居"))
        )).when(graphQueryService).executeQuery(contains("UNWIND nodes"), anyMap());
        doReturn(List.of()).when(graphQueryService).executeQuery(contains("UNWIND relationships"), anyMap());

        GraphQueryResponse response = graphQueryService.expand("node-X", 1);

        assertThat(response.getNodes()).hasSize(2);
        verify(graphQueryService).resolveStartNodeIds(eq("node-X"), isNull());
    }
}
