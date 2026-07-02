package com.metaplatform.ai.llm;

import java.util.Map;

/**
 * LLM response: unified response format.
 */
public record LlmResponse(
    String id,
    String model,
    String content,
    String finishReason,
    TokenUsage usage,
    Map<String, Object> metadata
) {
    public record TokenUsage(
        int promptTokens,
        int completionTokens,
        int totalTokens
    ) {}

    public static LlmResponse empty() {
        return new LlmResponse("", "", "", "error", new TokenUsage(0, 0, 0), Map.of());
    }
}
