package com.metaplatform.wfe.engine.parser;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.wfe.common.ErrorCode;
import com.metaplatform.wfe.engine.model.FlowDocument;
import com.metaplatform.wfe.engine.model.FlowNode;
import com.metaplatform.wfe.exception.WfeException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * FlowGram.AI fixed-layout JSON 解析器。
 * 负责解析/序列化 FlowDocument，并提供树形结构的查询与遍历能力。
 */
@Component
@RequiredArgsConstructor
public class FlowGramParser {

    private final ObjectMapper objectMapper;

    /**
     * 解析 JSON 字符串为 FlowDocument。
     */
    public FlowDocument parse(String json) {
        try {
            return objectMapper.readValue(json, FlowDocument.class);
        } catch (Exception e) {
            throw new WfeException(ErrorCode.BPMN_PARSE_FAILED, "FlowGram JSON 解析失败: " + e.getMessage());
        }
    }

    /**
     * 序列化 FlowDocument 为 JSON。
     */
    public String serialize(FlowDocument doc) {
        try {
            return objectMapper.writeValueAsString(doc);
        } catch (Exception e) {
            throw new WfeException(ErrorCode.INTERNAL_ERROR, "FlowGram JSON 序列化失败: " + e.getMessage());
        }
    }

    /**
     * 扁平化节点树（深度优先遍历，返回有序节点列表）。
     * 先访问节点本身，再递归访问 blocks 子节点。
     */
    public List<FlowNode> flattenNodes(FlowDocument doc) {
        List<FlowNode> result = new ArrayList<>();
        if (doc == null || doc.nodes() == null) {
            return result;
        }
        for (FlowNode node : doc.nodes()) {
            flattenRecursive(node, result);
        }
        return result;
    }

    /**
     * 扁平化单个节点的子节点（递归）。
     */
    private void flattenRecursive(FlowNode node, List<FlowNode> result) {
        if (node == null) {
            return;
        }
        result.add(node);
        if (node.blocks() != null) {
            for (FlowNode child : node.blocks()) {
                flattenRecursive(child, result);
            }
        }
    }

    /**
     * 获取某节点的下一兄弟节点（同层级）。
     * 简化版：基于扁平化列表顺序查找，不考虑 switch/if 分支跳转。
     */
    public FlowNode findNextSibling(FlowDocument doc, String currentNodeId) {
        List<FlowNode> flattened = flattenNodes(doc);
        for (int i = 0; i < flattened.size(); i++) {
            if (currentNodeId.equals(flattened.get(i).id())) {
                if (i + 1 < flattened.size()) {
                    return flattened.get(i + 1);
                }
                return null;
            }
        }
        return null;
    }

    /**
     * 根据 ID 查找节点。
     */
    public FlowNode findNodeById(FlowDocument doc, String nodeId) {
        if (doc == null || doc.nodes() == null) {
            return null;
        }
        for (FlowNode node : doc.nodes()) {
            FlowNode found = findNodeByIdRecursive(node, nodeId);
            if (found != null) {
                return found;
            }
        }
        return null;
    }

    private FlowNode findNodeByIdRecursive(FlowNode node, String nodeId) {
        if (node == null) {
            return null;
        }
        if (nodeId.equals(node.id())) {
            return node;
        }
        if (node.blocks() != null) {
            for (FlowNode child : node.blocks()) {
                FlowNode found = findNodeByIdRecursive(child, nodeId);
                if (found != null) {
                    return found;
                }
            }
        }
        return null;
    }

    /**
     * 验证流程定义（必须有 start 和 end 节点）。
     */
    public void validate(FlowDocument doc) {
        if (doc == null || doc.nodes() == null || doc.nodes().isEmpty()) {
            throw new WfeException(ErrorCode.BPMN_PARSE_FAILED, "FlowGram 文档为空或不包含任何节点");
        }
        boolean hasStart = false;
        boolean hasEnd = false;
        for (FlowNode node : flattenNodes(doc)) {
            if ("start".equals(node.type())) {
                hasStart = true;
            }
            if ("end".equals(node.type())) {
                hasEnd = true;
            }
        }
        if (!hasStart) {
            throw new WfeException(ErrorCode.BPMN_PARSE_FAILED, "FlowGram 文档缺少 start 节点");
        }
        if (!hasEnd) {
            throw new WfeException(ErrorCode.BPMN_PARSE_FAILED, "FlowGram 文档缺少 end 节点");
        }
    }

    /**
     * 查找 start 节点。
     */
    public FlowNode findStartNode(FlowDocument doc) {
        if (doc == null || doc.nodes() == null) {
            return null;
        }
        for (FlowNode node : doc.nodes()) {
            if ("start".equals(node.type())) {
                return node;
            }
        }
        return null;
    }
}
