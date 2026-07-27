package com.metaplatform.agent.steps;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.Map;

/**
 * 工具调用记录响应。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ToolCallResponse {

    private String toolCallId;
    private String executionId;
    private String tenantId;
    private String toolName;
    private Map<String, Object> toolInput;
    private Map<String, Object> toolOutput;
    private String status;
    private Integer durationMs;
    private OffsetDateTime createdAt;
}
