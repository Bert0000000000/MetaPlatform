package com.metaplatform.ai.interfaces.rest.dto;

import java.util.List;

public record ChatRequest(
    String model,
    List<Message> messages,
    Double temperature,
    Integer maxTokens
) {
    public record Message(String role, String content) {}
}
