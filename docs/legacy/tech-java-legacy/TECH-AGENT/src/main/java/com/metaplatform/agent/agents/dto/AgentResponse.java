package com.metaplatform.agent.agents.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * Agent 响应 DTO（camelCase，对齐前端约定）。
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AgentResponse {

    private String agentId;
    private String tenantId;
    private String code;
    private String name;
    private String description;
    private String modelId;
    private String systemPrompt;
    private List<String> tools;
    private List<String> ragScopes;
    private Double temperature;
    private Integer maxTokens;
    private String status;
    private OffsetDateTime deletedAt;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
