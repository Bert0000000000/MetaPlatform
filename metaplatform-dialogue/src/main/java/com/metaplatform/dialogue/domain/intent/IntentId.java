package com.metaplatform.dialogue.domain.intent;

import java.util.Objects;
import java.util.UUID;

/**
 * 意图唯一标识。
 */
public record IntentId(String value) {
    public IntentId {
        Objects.requireNonNull(value, "IntentId must not be null");
        if (value.isBlank()) {
            throw new IllegalArgumentException("IntentId must not be blank");
        }
    }

    public static IntentId newId() {
        return new IntentId(UUID.randomUUID().toString());
    }

    public static IntentId of(String value) {
        return new IntentId(value);
    }

    @Override
    public String toString() {
        return value;
    }
}
