package com.metaplatform.llmgw.chat.dto;

import java.util.List;
import java.util.Map;

public record ChatRequest(
    String model,
    List<ChatMessage> messages,
    Double temperature,
    Double topP,
    Integer maxTokens,
    List<String> stop,
    Boolean stream,
    Map<String, Object> metadata
) {
    public ChatRequest {
        if (model == null || model.isBlank()) model = "qwen-max";
        if (temperature == null) temperature = 0.7;
        if (topP == null) topP = 0.9;
        if (maxTokens == null) maxTokens = 2000;
        if (stream == null) stream = false;
    }
}
