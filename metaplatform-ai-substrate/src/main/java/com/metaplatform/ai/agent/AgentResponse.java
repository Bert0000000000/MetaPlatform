package com.metaplatform.ai.agent;

import java.util.Map;

public record AgentResponse(
    String content,
    String toolUsed,
    Map<String, Object> toolArguments,
    String toolResult,
    TokenUsage usage
) {
    public record TokenUsage(
        int promptTokens,
        int completionTokens,
        int totalTokens
    ) {}
}
