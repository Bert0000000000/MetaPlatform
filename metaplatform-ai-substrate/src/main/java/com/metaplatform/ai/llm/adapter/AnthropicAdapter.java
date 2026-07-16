package com.metaplatform.ai.llm.adapter;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.metaplatform.ai.llm.LlmAdapter;
import com.metaplatform.ai.llm.LlmRequest;
import com.metaplatform.ai.llm.LlmResponse;
import okhttp3.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Component
public class AnthropicAdapter implements LlmAdapter {

    private static final Logger log = LoggerFactory.getLogger(AnthropicAdapter.class);

    private final String apiKey;
    private final String baseUrl;
    private final OkHttpClient httpClient;
    private final ObjectMapper mapper;

    public AnthropicAdapter(
            @Value("${ai.anthropic.api-key}") String apiKey,
            @Value("${ai.anthropic.base-url:https://api.anthropic.com/v1}") String baseUrl,
            ObjectMapper mapper) {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
        this.mapper = mapper;
        this.httpClient = new OkHttpClient.Builder()
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(120, TimeUnit.SECONDS)
                .build();
    }

    @Override
    public String name() {
        return "anthropic";
    }

    @Override
    public boolean supportsModel(String model) {
        return model.startsWith("claude-");
    }

    @Override
    public LlmResponse chat(LlmRequest request) {
        try {
            ObjectNode body = mapper.createObjectNode();
            body.put("model", request.model());
            body.put("max_tokens", request.maxTokens());
            body.put("temperature", request.temperature());

            // Anthropic uses messages format; system messages are handled separately
            String systemPrompt = request.messages().stream()
                    .filter(m -> "system".equals(m.role()))
                    .map(LlmRequest.ChatMessage::content)
                    .reduce("", (a, b) -> a + "\n" + b);

            if (!systemPrompt.isBlank()) {
                body.put("system", systemPrompt.trim());
            }

            ArrayNode messagesNode = body.putArray("messages");
            request.messages().stream()
                    .filter(m -> !"system".equals(m.role()))
                    .forEach(msg -> {
                        ObjectNode msgNode = messagesNode.addObject();
                        msgNode.put("role", msg.role());
                        msgNode.put("content", msg.content());
                    });

            String jsonBody = mapper.writeValueAsString(body);

            Request httpRequest = new Request.Builder()
                    .url(baseUrl + "/messages")
                    .addHeader("x-api-key", apiKey)
                    .addHeader("anthropic-version", "2023-06-01")
                    .addHeader("Content-Type", "application/json")
                    .post(RequestBody.create(jsonBody, MediaType.parse("application/json")))
                    .build();

            try (Response response = httpClient.newCall(httpRequest).execute()) {
                String responseBody = response.body() != null ? response.body().string() : "";

                if (!response.isSuccessful()) {
                    log.error("Anthropic API error: status={}, body={}", response.code(), responseBody);
                    throw new RuntimeException("Anthropic API error: " + response.code());
                }

                JsonNode root = mapper.readTree(responseBody);
                JsonNode contentBlock = root.path("content").path(0);
                JsonNode usage = root.path("usage");

                return new LlmResponse(
                        root.path("id").asText(),
                        root.path("model").asText(),
                        contentBlock.path("text").asText(),
                        root.path("stop_reason").asText("end_turn"),
                        new LlmResponse.TokenUsage(
                                usage.path("input_tokens").asInt(0),
                                usage.path("output_tokens").asInt(0),
                                usage.path("input_tokens").asInt(0) + usage.path("output_tokens").asInt(0)
                        ),
                        Map.of()
                );
            }
        } catch (IOException e) {
            log.error("Failed to call Anthropic API: {}", e.getMessage(), e);
            throw new RuntimeException("Anthropic API call failed", e);
        }
    }
}
