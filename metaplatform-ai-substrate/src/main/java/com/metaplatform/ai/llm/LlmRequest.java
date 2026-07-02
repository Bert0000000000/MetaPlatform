package com.metaplatform.ai.llm;

import java.util.List;
import java.util.Map;

/**
 * LLM request: unified request format. Adapters are responsible for converting to vendor-specific formats.
 */
public record LlmRequest(
    String model,
    List<ChatMessage> messages,
    double temperature,
    int maxTokens,
    Map<String, Object> extra
) {
    public LlmRequest {
        if (model == null || model.isBlank()) {
            throw new IllegalArgumentException("model must not be blank");
        }
        if (messages == null || messages.isEmpty()) {
            throw new IllegalArgumentException("messages must not be empty");
        }
        if (temperature < 0 || temperature > 2) {
            throw new IllegalArgumentException("temperature must be between 0 and 2");
        }
    }

    public record ChatMessage(
        String role,
        String content
    ) {
        public ChatMessage {
            if (role == null || role.isBlank()) {
                throw new IllegalArgumentException("role must not be blank");
            }
            if (content == null) {
                content = "";
            }
        }
    }

    public static LlmRequest simple(String model, String userMessage) {
        return new LlmRequest(
                model,
                List.of(new ChatMessage("user", userMessage)),
                0.7,
                1024,
                Map.of()
        );
    }
}
