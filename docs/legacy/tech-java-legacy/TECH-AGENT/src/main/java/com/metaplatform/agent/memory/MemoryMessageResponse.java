package com.metaplatform.agent.memory;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.Map;

/**
 * 记忆消息响应。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class MemoryMessageResponse {

    private String messageId;
    private String sessionId;
    private String agentId;
    private String tenantId;
    private String role;
    private String content;
    private Map<String, Object> metadata;
    private OffsetDateTime createdAt;
}
