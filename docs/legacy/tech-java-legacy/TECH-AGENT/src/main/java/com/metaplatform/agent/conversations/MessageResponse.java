package com.metaplatform.agent.conversations;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.Map;

/**
 * 消息响应。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class MessageResponse {

    private String messageId;
    private String conversationId;
    private String tenantId;
    private String role;
    private String content;
    private Map<String, Object> metadata;
    private OffsetDateTime createdAt;
}
