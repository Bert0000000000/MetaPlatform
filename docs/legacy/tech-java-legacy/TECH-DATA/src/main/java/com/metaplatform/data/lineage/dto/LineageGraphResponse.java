package com.metaplatform.data.lineage.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;
import java.util.Map;

/**
 * 数据血缘图响应。
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LineageGraphResponse {

    private String tenantId;
    private List<LineageNode> nodes;
    private List<LineageEdge> edges;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class LineageNode {
        private String id;
        private String name;
        private String type;
        private String source;
        private Map<String, Object> metadata;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class LineageEdge {
        private String source;
        private String target;
        private String relationship;
    }
}
