package com.metaplatform.agent.tasks;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.Map;

/**
 * Agent 任务响应。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class TaskResponse {

    private String taskId;
    private String tenantId;
    private String agentId;
    private String title;
    private String description;
    private String status;
    private String priority;
    private String assignedTo;
    private Map<String, Object> input;
    private Map<String, Object> output;
    private String errorMessage;
    private OffsetDateTime createdAt;
    private OffsetDateTime startedAt;
    private OffsetDateTime completedAt;
}
