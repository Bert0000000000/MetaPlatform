package com.metaplatform.agent.memory;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

/**
 * 记忆会话响应。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class MemorySessionResponse {

    private String sessionId;
    private String agentId;
    private String tenantId;
    private String title;
    private Integer messageCount;
    private OffsetDateTime lastMessageAt;
    private OffsetDateTime createdAt;
}
