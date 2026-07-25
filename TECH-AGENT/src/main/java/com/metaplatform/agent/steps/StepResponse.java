package com.metaplatform.agent.steps;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.Map;

/**
 * 执行步骤响应。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class StepResponse {

    private String stepId;
    private String executionId;
    private String tenantId;
    private String stepType;
    private String content;
    private Integer sortOrder;
    private Map<String, Object> metadata;
    private OffsetDateTime createdAt;
}
