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

    public static ChatResponse success(String content, String model) {
        return new ChatResponse(
                "chatcmpl-" + java.util.UUID.randomUUID(),
                model == null ? "default" : model,
                List.of(new Choice(0, new ChatMessage("assistant", content == null ? "" : content), "stop")),
                new Usage(0, 0, 0),
                "stop");
    }

    public static ChatResponse error(String code, String message) {
        return new ChatResponse("err-" + code, "error", List.of(), new Usage(0, 0, 0), message);
    }
}
