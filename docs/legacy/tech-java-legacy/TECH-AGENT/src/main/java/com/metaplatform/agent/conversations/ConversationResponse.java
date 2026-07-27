package com.metaplatform.agent.conversations;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

/**
 * 对话响应。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ConversationResponse {

    private String id;
    private String conversationId;
    private String tenantId;
    private String agentId;
    private String title;
    private String status;
    private Integer messageCount;
    private Boolean favorite;
    private String mode;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
    private OffsetDateTime lastMessageAt;

    /** 预览文本（最后一条消息摘要）。 */
    @Builder.Default
    private String preview = "";
}
