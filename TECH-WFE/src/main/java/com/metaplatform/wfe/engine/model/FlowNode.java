package com.metaplatform.wfe.engine.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.Map;

/**
 * FlowGram.AI fixed-layout 节点。
 * 通过 blocks 子数组形成树形嵌套，支持原生节点类型 start/end/switch/case/if/loop/tryCatch
 * 以及扩展自定义节点 approval（审批任务）。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record FlowNode(
        String id,
        String type,
        @JsonProperty("blocks") List<FlowNode> blocks,
        Map<String, Object> data
) {
    public String title() {
        return data != null ? (String) data.get("title") : null;
    }

    public String assignee() {
        return data != null ? (String) data.get("assignee") : null;
    }
}
