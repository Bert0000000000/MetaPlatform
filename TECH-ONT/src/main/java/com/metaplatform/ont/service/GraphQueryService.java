package com.metaplatform.ont.service;

import com.metaplatform.ont.dto.GraphEdgeDto;
import com.metaplatform.ont.dto.GraphNodeDto;
import com.metaplatform.ont.dto.GraphQueryRequest;
import com.metaplatform.ont.dto.GraphQueryResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 知识图谱查询服务（P1-ONT-05, V12-01）。
 * 使用 Neo4j Cypher 路径查询，解析为 nodes + edges。
 * <p>
 * 支持两种起始方式：
 * 1) startNodeId：从指定节点按 depth 跳数扩展子图；
 * 2) query（自然语言/关键字）：先在 Neo4j 模糊匹配 Concept/Entity 节点，
 *    再以匹配到的节点为起点扩展子图。
 * <p>
 * 支持节点类型（concept/entity/relation）、属性、标签筛选。
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
        String query = request.getQuery();
        List<String> nodeTypes = request.getNodeTypes();
        Map<String, Object> properties = request.getProperties();
        List<String> tags = request.getTags();

        // 解析起始节点 ID 列表
        List<String> startNodeIds = resolveStartNodeIds(startNodeId, query);
        if (startNodeIds.isEmpty()) {
            return GraphQueryResponse.builder()
                    .nodes(List.of())
                    .edges(List.of())
                    .build();
        }

        String relationFilter = StringUtils.hasText(relationType)
                ? " AND all(rel IN r WHERE rel.relationTypeCode = $relationType)"
                : "";

        String nodeCypher = String.format(
                "MATCH path = (n)-[r*0..%d]-(m) WHERE n.id IN $startNodeIds%s " +
                "UNWIND nodes(path) as node " +
                "RETURN DISTINCT node.id as id, labels(node) as labels, properties(node) as properties",
                depth, relationFilter);

        String relCypher = String.format(
                "MATCH path = (n)-[r*1..%d]-(m) WHERE n.id IN $startNodeIds%s " +
                "UNWIND relationships(path) as rel " +
                "RETURN DISTINCT elementId(rel) as id, type(rel) as type, " +
                "startNode(rel).id as source, endNode(rel).id as target, properties(rel) as properties",
                depth, relationFilter);

        Map<String, Object> params = new HashMap<>();
        params.put("startNodeIds", startNodeIds);
        if (StringUtils.hasText(relationType)) {
            params.put("relationType", relationType);
        }

        Collection<Map<String, Object>> nodeRecords = executeQuery(nodeCypher, params);
        Collection<Map<String, Object>> relRecords = executeQuery(relCypher, params);

        List<GraphNodeDto> nodes = nodeRecords.stream()
                .map(this::toNodeDto)
                .filter(n -> matchesNodeType(n, nodeTypes))
                .filter(n -> matchesProperties(n, properties))
                .filter(n -> matchesTags(n, tags))
                .collect(Collectors.collectingAndThen(
                        Collectors.toMap(GraphNodeDto::getId, n -> n, (a, b) -> a),
                        m -> new ArrayList<>(m.values())));

        Set<String> visibleNodeIds = nodes.stream().map(GraphNodeDto::getId).collect(Collectors.toSet());

        List<GraphEdgeDto> edges = relRecords.stream()
                .map(this::toEdgeDto)
                .filter(e -> visibleNodeIds.contains(e.getSource()) && visibleNodeIds.contains(e.getTarget()))
                .collect(Collectors.collectingAndThen(
                        Collectors.toMap(GraphEdgeDto::getId, e -> e, (a, b) -> a),
                        m -> new ArrayList<>(m.values())));

        return GraphQueryResponse.builder()
                .nodes(nodes)
                .edges(edges)
                .build();
    }

    /**
     * 节点展开（REQ-035）：返回某节点的 1 跳邻居子图。
     * 用于前端 KnowledgeGraph 点击节点时增量加载子节点。
     */
    public GraphQueryResponse expand(String nodeId, int depth) {
        GraphQueryRequest request = new GraphQueryRequest();
        request.setStartNodeId(nodeId);
        request.setDepth(Math.max(1, Math.min(5, depth)));
        return query(request);
    }

    /**
     * 解析起始节点 ID 列表。
     * 1) 显式指定 startNodeId 时直接返回；
     * 2) 否则按 query 关键字在 Neo4j 中模糊匹配 Concept/Entity 节点
     *    （匹配 name/code/description），返回前 20 条节点 ID。
     */
    protected List<String> resolveStartNodeIds(String startNodeId, String query) {
        if (StringUtils.hasText(startNodeId)) {
            return List.of(startNodeId);
        }
        if (!StringUtils.hasText(query)) {
            return List.of();
        }
        String cypher =
                "MATCH (n) WHERE (n:Concept OR n:Entity) AND (" +
                "  toLower(n.name) CONTAINS toLower($keyword) OR " +
                "  toLower(n.code) CONTAINS toLower($keyword) OR " +
                "  (n.description IS NOT NULL AND toLower(n.description) CONTAINS toLower($keyword))" +
                ") RETURN n.id as id LIMIT 20";
        Collection<Map<String, Object>> records = executeQuery(cypher, Map.of("keyword", query.trim()));
        List<String> ids = new ArrayList<>();
        for (Map<String, Object> record : records) {
            Object id = record.get("id");
            if (id != null) {
                ids.add(String.valueOf(id));
            }
        }
        return ids;
    }

    @SuppressWarnings("unchecked")
    protected Collection<Map<String, Object>> executeQuery(String cypher, Map<String, Object> params) {
        return neo4jClient.query(cypher).bindAll(params).fetch().all();
    }

    @SuppressWarnings("unchecked")
    private GraphNodeDto toNodeDto(Map<String, Object> record) {
        String id = String.valueOf(record.get("id"));
        List<String> labels = (List<String>) record.get("labels");
        String neo4jLabel = labels != null && !labels.isEmpty() ? labels.get(0) : "Unknown";
        Map<String, Object> properties = (Map<String, Object>) record.get("properties");
        String name = properties != null && properties.get("name") != null
                ? String.valueOf(properties.get("name"))
                : id;
        return GraphNodeDto.builder()
                .id(id)
                .label(name)
                .type(mapNodeType(neo4jLabel))
                .properties(properties)
                .build();
    }

    /**
     * Neo4j label → 前端 type 映射。
     */
    private String mapNodeType(String neo4jLabel) {
        if (neo4jLabel == null) return "entity";
        return switch (neo4jLabel) {
            case "Concept" -> "concept";
            case "Entity" -> "entity";
            case "Relation" -> "relation";
            default -> "entity";
        };
    }

    @SuppressWarnings("unchecked")
    private GraphEdgeDto toEdgeDto(Map<String, Object> record) {
        String id = String.valueOf(record.get("id"));
        String type = String.valueOf(record.get("type"));
        String source = String.valueOf(record.get("source"));
        String target = String.valueOf(record.get("target"));
        Map<String, Object> properties = (Map<String, Object>) record.get("properties");
        String label = properties != null && properties.get("relationTypeCode") != null
                ? String.valueOf(properties.get("relationTypeCode"))
                : type;
        return GraphEdgeDto.builder()
                .id(id)
                .source(source)
                .target(target)
                .type(type)
                .label(label)
                .properties(properties)
                .build();
    }

    private boolean matchesNodeType(GraphNodeDto node, List<String> nodeTypes) {
        if (CollectionUtils.isEmpty(nodeTypes)) {
            return true;
        }
        return nodeTypes.contains(node.getType());
    }

    private boolean matchesProperties(GraphNodeDto node, Map<String, Object> properties) {
        if (CollectionUtils.isEmpty(properties)) {
            return true;
        }
        Map<String, Object> nodeProps = node.getProperties();
        if (nodeProps == null) {
            return false;
        }
        for (Map.Entry<String, Object> entry : properties.entrySet()) {
            Object value = nodeProps.get(entry.getKey());
            if (value == null || !String.valueOf(value).equalsIgnoreCase(String.valueOf(entry.getValue()))) {
                return false;
            }
        }
        return true;
    }

    private boolean matchesTags(GraphNodeDto node, List<String> tags) {
        if (CollectionUtils.isEmpty(tags)) {
            return true;
        }
        Map<String, Object> nodeProps = node.getProperties();
        if (nodeProps == null) {
            return false;
        }
        Object rawTags = nodeProps.get("tags");
        if (rawTags instanceof Collection<?> col) {
            Set<String> tagSet = col.stream().map(String::valueOf).collect(Collectors.toSet());
            return tags.stream().anyMatch(tagSet::contains);
        }
        // 无 tags 字段时退化为按 name 模糊匹配
        String name = String.valueOf(nodeProps.get("name")).toLowerCase();
        return tags.stream().anyMatch(t -> name.contains(t.toLowerCase()));
    }
}
