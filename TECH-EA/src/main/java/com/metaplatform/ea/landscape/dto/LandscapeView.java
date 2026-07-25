package com.metaplatform.ea.landscape.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * 架构分层视图：BusinessCapability → Application → TechStack → Infrastructure。
 *
 * <p>由各层节点列表 + 层间关联边组成，用于前端 landscape 可视化与影响分析展示。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LandscapeView {

    private String tenantId;
    private List<Layer> layers;
    private List<LayerEdge> edges;
    private Instant generatedAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Layer {
        /** BUSINESS_CAPABILITY / APPLICATION / TECH_STACK / INFRASTRUCTURE */
        private String name;
        /** 该层节点总数 */
        private int nodeCount;
        private List<LayerNode> nodes;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LayerNode {
        private UUID id;
        private String code;
        private String name;
        private String type;
        private String status;
        private UUID parentId;
        private Integer level;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LayerEdge {
        /** 上游层名 */
        private String fromLayer;
        /** 下游层名 */
        private String toLayer;
        private UUID fromId;
        private UUID toId;
        /** 关联类型，例如 OWNS / USES / DEPLOYS_TO */
        private String relationshipType;
    }
}
