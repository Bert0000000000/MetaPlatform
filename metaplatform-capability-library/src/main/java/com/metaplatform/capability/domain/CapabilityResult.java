package com.metaplatform.capability.domain;

import java.util.Map;
import java.util.Objects;

/**
 * 能力执行结果。
 */
public record CapabilityResult(
        boolean success,
        String message,
        Map<String, Object> data,
        long executionTimeMs
) {
    public CapabilityResult {
        data = data != null ? Map.copyOf(data) : Map.of();
    }

    public static CapabilityResult success(String message, Map<String, Object> data) {
        return new CapabilityResult(true, message, data, 0);
    }

    public static CapabilityResult success(String message, Map<String, Object> data, long executionTimeMs) {
        return new CapabilityResult(true, message, data, executionTimeMs);
    }

    public static CapabilityResult failure(String message) {
        return new CapabilityResult(false, message, Map.of(), 0);
    }

    public static CapabilityResult failure(String message, long executionTimeMs) {
        return new CapabilityResult(false, message, Map.of(), executionTimeMs);
    }
}
