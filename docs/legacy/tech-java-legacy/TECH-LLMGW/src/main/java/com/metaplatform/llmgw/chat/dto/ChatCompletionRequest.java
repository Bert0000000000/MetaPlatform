package com.metaplatform.llmgw.chat.dto;

import java.util.List;

public record ChatCompletionRequest(
    String model,
    List<ChatMessage> messages,
    Double temperature,
    Double topP,
    Integer maxTokens,
    Boolean stream,
    String user
) {
    public ChatCompletionRequest {
        if (model == null || model.isBlank()) model = "qwen-max";
        if (temperature == null) temperature = 0.7;
        if (stream == null) stream = false;
    }
}
