package com.metaplatform.ai.interfaces.rest.dto;

public record ChatResponse(
    String id,
    String model,
    String content,
    String finishReason,
    int promptTokens,
    int completionTokens,
    int totalTokens
) {}
