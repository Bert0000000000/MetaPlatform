package com.metaplatform.agent.evaluation;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 自动评分结果。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AutoScoreResult {

    private String conversationId;
    private double overallScore;
    private List<DimensionScore> dimensions;
    private String evaluatorModel;
    private OffsetDateTime evaluatedAt;
    private String summary;
    /** LLM / MANUAL / HYBRID */
    private String mode;

    /**
     * 单维度评分。
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class DimensionScore {
        /** accuracy / helpfulness / compliance / efficiency / toolUsage / contextCoherence */
        private String dimension;
        private double score;
        private Double weight;
        private String reasoning;
        private List<String> evidence;
    }
}
