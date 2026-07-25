package com.metaplatform.agent.evaluation;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 评分规则（加权维度集合）。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ScoringRubric {

    private String id;
    private String name;
    private List<RubricDimension> dimensions;
    private OffsetDateTime updatedAt;

    /**
     * 规则中的单个加权维度。
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class RubricDimension {
        private String dimension;
        private double weight;
        private String description;
    }
}
