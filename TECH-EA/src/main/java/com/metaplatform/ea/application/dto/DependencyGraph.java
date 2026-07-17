package com.metaplatform.ea.application.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DependencyGraph {

    private UUID rootApplicationId;
    private List<GraphNode> nodes;
    private List<GraphEdge> edges;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class GraphNode {
        private UUID id;
        private String name;
        private String code;
        private String appType;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class GraphEdge {
        private UUID from;
        private UUID to;
        private String dependencyType;
    }
}
