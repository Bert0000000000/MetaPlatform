package com.metaplatform.obs.topology.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ServiceTopologyResponse {
    private List<ServiceNode> nodes;
    private List<ServiceEdge> edges;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ServiceNode {
        private String service;
        private String status;
        private double responseTimeMs;
        private double errorRate;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ServiceEdge {
        private String source;
        private String target;
        private long callCount;
        private double avgDurationMs;
    }
}