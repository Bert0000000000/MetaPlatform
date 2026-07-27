package com.metaplatform.agent.tools;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.Map;

/**
 * Agent 工具响应。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ToolResponse {

    private String toolId;
    private String tenantId;
    private String agentId;
    private String name;
    private String description;
    private String toolType;
    private Map<String, Object> config;
    private Map<String, Object> inputSchema;
    private Map<String, Object> outputSchema;
    private Boolean enabled;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
