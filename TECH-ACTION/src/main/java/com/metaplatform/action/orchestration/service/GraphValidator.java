package com.metaplatform.action.orchestration.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.action.common.ErrorCode;
import com.metaplatform.action.exception.ActionException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Component
@RequiredArgsConstructor
public class GraphValidator {

    public static final String NODE_SERIAL = "SERIAL";
    public static final String NODE_PARALLEL = "PARALLEL";
    public static final String NODE_CONDITIONAL = "CONDITIONAL";

    private static final Set<String> ALLOWED_NODE_TYPES = Set.of(NODE_SERIAL, NODE_PARALLEL, NODE_CONDITIONAL);

    private final ObjectMapper objectMapper;

    public void validate(String nodesJson, String edgesJson) {
        JsonNode nodes = parseJson(nodesJson, "nodes");
        JsonNode edges = parseJson(edgesJson, "edges");

        if (!nodes.isArray()) {
            throw new ActionException(ErrorCode.INVALID_GRAPH, "nodes 必须是数组");
        }
        if (!edges.isArray()) {
            throw new ActionException(ErrorCode.INVALID_GRAPH, "edges 必须是数组");
        }

        Set<String> nodeIds = new HashSet<>();
        for (JsonNode node : nodes) {
            String id = textField(node, "id");
            String type = textField(node, "type");
            if (id == null || id.isBlank()) {
                throw new ActionException(ErrorCode.INVALID_GRAPH, "节点 id 不能为空");
            }
            if (!nodeIds.add(id)) {
                throw new ActionException(ErrorCode.INVALID_GRAPH, "节点 id 重复: " + id);
            }
            if (!ALLOWED_NODE_TYPES.contains(type)) {
                throw new ActionException(ErrorCode.INVALID_GRAPH,
                        "节点 type 非法: " + type + "，允许: SERIAL/PARALLEL/CONDITIONAL");
            }
        }

        Map<String, List<String>> adjacency = new HashMap<>();
        for (String id : nodeIds) {
            adjacency.put(id, new ArrayList<>());
        }
        Set<String> nodesWithIncoming = new HashSet<>();
        for (JsonNode edge : edges) {
            String source = textField(edge, "source");
            String target = textField(edge, "target");
            if (source == null || target == null) {
                throw new ActionException(ErrorCode.INVALID_GRAPH, "边 source/target 不能为空");
            }
            if (!nodeIds.contains(source)) {
                throw new ActionException(ErrorCode.INVALID_GRAPH, "边 source 引用不存在的节点: " + source);
            }
            if (!nodeIds.contains(target)) {
                throw new ActionException(ErrorCode.INVALID_GRAPH, "边 target 引用不存在的节点: " + target);
            }
            if (source.equals(target)) {
                throw new ActionException(ErrorCode.CYCLE_DETECTED, "存在自环边: " + source);
            }
            adjacency.get(source).add(target);
            nodesWithIncoming.add(target);
        }

        detectCycle(nodeIds, adjacency);
    }

    private void detectCycle(Set<String> nodeIds, Map<String, List<String>> adjacency) {
        Set<String> visiting = new HashSet<>();
        Set<String> visited = new HashSet<>();
        for (String node : nodeIds) {
            if (dfs(node, adjacency, visiting, visited)) {
                throw new ActionException(ErrorCode.CYCLE_DETECTED, "编排节点存在循环依赖");
            }
        }
    }

    private boolean dfs(String node, Map<String, List<String>> adjacency, Set<String> visiting, Set<String> visited) {
        if (visited.contains(node)) {
            return false;
        }
        if (visiting.contains(node)) {
            return true;
        }
        visiting.add(node);
        for (String next : adjacency.getOrDefault(node, List.of())) {
            if (dfs(next, adjacency, visiting, visited)) {
                return true;
            }
        }
        visiting.remove(node);
        visited.add(node);
        return false;
    }

    private JsonNode parseJson(String json, String field) {
        try {
            return objectMapper.readTree(json == null || json.isBlank() ? "[]" : json);
        } catch (Exception e) {
            throw new ActionException(ErrorCode.INVALID_PARAM, field + " 不是合法的 JSON");
        }
    }

    private String textField(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? null : value.asText();
    }
}
