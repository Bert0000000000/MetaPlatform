package com.metaplatform.capability.domain;

import java.util.Objects;
import java.util.UUID;

/**
 * 流水线唯一标识。
 */
public record PipelineId(String value) {
    public PipelineId {
        Objects.requireNonNull(value, "PipelineId must not be null");
        if (value.isBlank()) {
            throw new IllegalArgumentException("PipelineId must not be blank");
        }
    }

    public static PipelineId newId() {
        return new PipelineId(UUID.randomUUID().toString());
    }

    public static PipelineId of(String value) {
        return new PipelineId(value);
    }

    @Override
    public String toString() {
        return value;
    }
}
