package com.metaplatform.dialogue.domain.message;

import java.util.Objects;
import java.util.UUID;

/**
 * 消息唯一标识。
 */
public record MessageId(String value) {
    public MessageId {
        Objects.requireNonNull(value, "MessageId must not be null");
        if (value.isBlank()) {
            throw new IllegalArgumentException("MessageId must not be blank");
        }
    }

    public static MessageId newId() {
        return new MessageId(UUID.randomUUID().toString());
    }

    public static MessageId of(String value) {
        return new MessageId(value);
    }

    @Override
    public String toString() {
        return value;
    }
}
