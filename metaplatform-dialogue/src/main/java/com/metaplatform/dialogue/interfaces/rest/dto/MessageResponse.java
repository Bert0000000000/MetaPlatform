package com.metaplatform.dialogue.interfaces.rest.dto;

import com.metaplatform.dialogue.domain.message.Message;
import com.metaplatform.dialogue.domain.message.MessageRole;

import java.time.Instant;
import java.util.Map;

/**
 * 消息响应DTO。
 */
public record MessageResponse(
        String id,
        String conversationId,
        MessageRole role,
        String content,
        Instant timestamp,
        Map<String, Object> metadata
) {
    public static MessageResponse from(Message message) {
        return new MessageResponse(
                message.id().value(),
                message.conversationId().value(),
                message.role(),
                message.content(),
                message.timestamp(),
                message.metadata()
        );
    }
}
