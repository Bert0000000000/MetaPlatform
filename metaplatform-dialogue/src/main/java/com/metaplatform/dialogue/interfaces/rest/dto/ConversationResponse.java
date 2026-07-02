package com.metaplatform.dialogue.interfaces.rest.dto;

import com.metaplatform.dialogue.domain.conversation.Conversation;
import com.metaplatform.dialogue.domain.conversation.ConversationStatus;

import java.time.Instant;
import java.util.Map;

/**
 * 会话响应DTO。
 */
public record ConversationResponse(
        String id,
        String userId,
        ConversationStatus status,
        Instant createdAt,
        Instant updatedAt,
        Map<String, Object> contextVariables
) {
    public static ConversationResponse from(Conversation conversation) {
        return new ConversationResponse(
                conversation.id().value(),
                conversation.userId(),
                conversation.status(),
                conversation.createdAt(),
                conversation.updatedAt(),
                conversation.contextVariables()
        );
    }
}
