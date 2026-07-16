package com.metaplatform.dialogue.domain.conversation;

import java.util.Objects;
import java.util.UUID;

/**
 * 会话唯一标识。
 */
public record ConversationId(String value) {
    public ConversationId {
        Objects.requireNonNull(value, "ConversationId must not be null");
        if (value.isBlank()) {
            throw new IllegalArgumentException("ConversationId must not be blank");
        }
    }

    public static ConversationId newId() {
        return new ConversationId(UUID.randomUUID().toString());
    }

    public static ConversationId of(String value) {
        return new ConversationId(value);
    }

    @Override
    public String toString() {
        return value;
    }
}
