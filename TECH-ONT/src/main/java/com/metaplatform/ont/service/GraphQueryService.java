package com.metaplatform.ont.service;

import com.metaplatform.ont.dto.GraphEdgeDto;
import com.metaplatform.ont.dto.GraphNodeDto;
import com.metaplatform.ont.dto.GraphQueryRequest;
import com.metaplatform.ont.dto.GraphQueryResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 知识图谱查询服务（P1-ONT-05）。
 * 使用 Neo4j Cypher 路径查询，解析为 nodes + edges。
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class GraphQueryService {

    private final Neo4jClient neo4jClient;

    public GraphQueryResponse query(GraphQueryRequest request) {
        int depth = request.getDepth() != null ? request.getDepth() : 2;
        String startNodeId = request.getStartNodeId();
        String relationType = request.getRelationType();

        String relationFilter = StringUtils.hasText(relationType)
                ? " AND all(rel IN r WHERE rel.relationTypeCode = $relationType"
                : "";

        String nodeCypher = String.format(
                "MATCH path = (n)-[r*1..%d]-(m) WHERE n.id = $startNodeId%s " +
                "UNWIND nodes(path) as node " +
                "RETURN DISTINCT node.id as id, labels(node) as labels, properties(node) as properties",
                depth, relationFilter);

        String relCypher = String.format(
                "MATCH path = (n)-[r*1..%d]-(m) WHERE n.id = $startNodeId%s " +
                "UNWIND relationships(path) as rel " +
                "RETURN DISTINCT elementId(rel) as id, type(rel) as type, " +
                "startNode(rel).id as source, endNode(rel).id as target, properties(rel) as properties",
                depth, relationFilter);

        Map<String, Object> params = new HashMap<>();
        params.put("startNodeId", startNodeId);
        if (StringUtils.hasText(relationType)) {
            params.put("relationType", relationType);
        }

        Collection<Map<String, Object>> nodeRecords = executeQuery(nodeCypher, params);
        Collection<Map<String, Object>> relRecords = executeQuery(relCypher, params);

        List<GraphNodeDto> nodes = nodeRecords.stream()
                .map(this::toNodeDto)
                .collect(Collectors.collectingAndThen(
                        Collectors.toMap(GraphNodeDto::getId, n -> n, (a, b) -> a),
                        m -> new ArrayList<>(m.values())));

        List<GraphEdgeDto> edges = relRecords.stream()
                .map(this::toEdgeDto)
                .collect(Collectors.collectingAndThen(
                        Collectors.toMap(GraphEdgeDto::getId, e -> e, (a, b) -> a),
                        m -> new ArrayList<>(m.values())));

        return GraphQueryResponse.builder()
                .nodes(nodes)
                .edges(edges)
                .build();
    }

    @SuppressWarnings("unchecked")
    protected Collection<Map<String, Object>> executeQuery(String cypher, Map<String, Object> params) {
        return neo4jClient.query(cypher).bindAll(params).fetch().all();
    }

    @SuppressWarnings("unchecked")
    private GraphNodeDto toNodeDto(Map<String, Object> record) {
        String id = String.valueOf(record.get("id"));
        List<String> labels = (List<String>) record.get("labels");
        String label = labels != null && !labels.isEmpty() ? labels.get(0) : "Unknown";
        Map<String, Object> properties = (Map<String, Object>) record.get("properties");
        return GraphNodeDto.builder()
                .id(id)
                .label(label)
                .properties(properties)
                .build();
    }

    @SuppressWarnings("unchecked")
    private GraphEdgeDto toEdgeDto(Map<String, Object> record) {
        String id = String.valueOf(record.get("id"));
        String type = String.valueOf(record.get("type"));
        String source = String.valueOf(record.get("source"));
        String target = String.valueOf(record.get("target"));
        Map<String, Object> properties = (Map<String, Object>) record.get("properties");
        return GraphEdgeDto.builder()
                .id(id)
                .source(source)
                .target(target)
                .type(type)
                .properties(properties)
                .build();
    }
}
