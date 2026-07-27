package com.metaplatform.ont.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.Getter;
import lombok.Setter;

import java.util.List;
import java.util.Map;

@Getter
@Setter
public class GraphQueryRequest {

    /**
     * 起始节点 ID（与 query 二选一）。
     * 指定时从该节点开始按 depth 跳数扩展子图。
     */
    private String startNodeId;

    /**
     * 自然语言或关键字查询（与 startNodeId 二选一）。
     * 后端先按 query 在 Neo4j 中匹配 Concept/Entity 节点，
     * 再以匹配到的节点为起点扩展子图。
     */
    private String query;

    @Min(value = 1, message = "查询深度最小为 1")
    @Max(value = 5, message = "查询深度最大为 5")
    private Integer depth = 2;

    /**
     * 关系类型过滤（关系类型 code，对应 relationTypeCode）。
     */
    private String relationType;

    /**
     * 节点类型过滤：concept / entity / relation。
     * 为空表示返回全部类型。
     */
    private List<String> nodeTypes;

    /**
     * 节点属性过滤（键值对，等值匹配）。
     * 例如 {"conceptCode": "CUSTOMER"}。
     */
    private Map<String, Object> properties;

    /**
     * 标签过滤（匹配节点 tags/labels 数组，模糊匹配）。
     */
    private List<String> tags;
}
