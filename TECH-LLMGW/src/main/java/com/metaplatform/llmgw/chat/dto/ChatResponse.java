package com.metaplatform.llmgw.chat.dto;

import java.util.List;

public record ChatResponse(
    String id,
    String model,
    List<Choice> choices,
    Usage usage,
    String finishReason
) {
    public record Choice(int index, ChatMessage message, String finishReason) {}
    public record Usage(int promptTokens, int completionTokens, int totalTokens) {}
}
