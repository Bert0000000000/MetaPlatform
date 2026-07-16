package com.metaplatform.ai.agent;

import java.util.Map;

/**
 * Tool definition: describes a tool that the Agent can invoke.
 */
public record ToolDefinition(
    String name,
    String description,
    Map<String, Object> parameters
) {
    public ToolDefinition {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("tool name must not be blank");
        }
        if (description == null || description.isBlank()) {
            throw new IllegalArgumentException("tool description must not be blank");
        }
    }
}
