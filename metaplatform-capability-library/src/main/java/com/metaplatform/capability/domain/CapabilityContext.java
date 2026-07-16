package com.metaplatform.capability.domain;

import java.util.Map;
import java.util.Objects;

/**
 * 能力执行上下文。传递输入参数给 Capability 执行。
 */
public record CapabilityContext(
        Map<String, Object> parameters,
        Map<String, Object> metadata
) {
    public CapabilityContext {
        parameters = parameters != null ? Map.copyOf(parameters) : Map.of();
        metadata = metadata != null ? Map.copyOf(metadata) : Map.of();
    }

    public static CapabilityContext of(Map<String, Object> parameters) {
        return new CapabilityContext(parameters, null);
    }

    public static CapabilityContext empty() {
        return new CapabilityContext(Map.of(), Map.of());
    }

    public Object getParameter(String key) {
        return parameters.get(key);
    }

    public String getStringParameter(String key) {
        Object val = parameters.get(key);
        return val != null ? val.toString() : null;
    }
}
