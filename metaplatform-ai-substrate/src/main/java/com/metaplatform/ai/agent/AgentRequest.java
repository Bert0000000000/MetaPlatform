package com.metaplatform.ai.agent;

import java.util.List;
import java.util.Map;

public record AgentRequest(
    String model,
    String systemPrompt,
    String userMessage,
    List<ToolDefinition> tools,
    Map<String, Object> context
) {
    public AgentRequest {
        if (userMessage == null || userMessage.isBlank()) {
            throw new IllegalArgumentException("userMessage must not be blank");
        }
    }
}
