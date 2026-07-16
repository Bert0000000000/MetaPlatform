package com.metaplatform.ai.interfaces.rest.dto;

import java.util.List;
import java.util.Map;

public record AgentApiRequest(
    String model,
    String systemPrompt,
    String userMessage,
    List<ToolSpec> tools
) {
    public record ToolSpec(
        String name,
        String description,
        Map<String, Object> parameters
    ) {}
}
