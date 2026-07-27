package com.metaplatform.agent.steps;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

/**
 * 执行评估响应。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class EvaluationResponse {

    private String evaluationId;
    private String executionId;
    private String tenantId;
    private Double score;
    private String feedback;
    private String evaluator;
    private OffsetDateTime createdAt;
}
