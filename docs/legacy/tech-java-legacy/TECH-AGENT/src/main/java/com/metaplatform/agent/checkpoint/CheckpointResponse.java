package com.metaplatform.agent.checkpoint;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.Map;

/**
 * 检查点响应。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CheckpointResponse {

    private String checkpointId;
    private String executionId;
    private String agentId;
    private String tenantId;
    private Map<String, Object> state;
    private OffsetDateTime createdAt;
}
