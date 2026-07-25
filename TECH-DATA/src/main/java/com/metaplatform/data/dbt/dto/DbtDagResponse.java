package com.metaplatform.data.dbt.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;
import java.util.Map;

/**
 * dbt DAG 响应。
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DbtDagResponse {

    private String projectId;
    private List<DagNode> nodes;
    private List<DagEdge> edges;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class DagNode {
        private String id;
        private String name;
        private String resourceType;
        private String materialized;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class DagEdge {
        private String source;
        private String target;
    }
}
