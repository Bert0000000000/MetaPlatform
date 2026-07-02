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
public class OpenAiAdapter implements LlmAdapter {

    private static final Logger log = LoggerFactory.getLogger(OpenAiAdapter.class);

    private final String apiKey;
    private final String baseUrl;
    private final OkHttpClient httpClient;
    private final ObjectMapper mapper;

    public OpenAiAdapter(
            @Value("${ai.openai.api-key}") String apiKey,
            @Value("${ai.openai.base-url:https://api.openai.com/v1}") String baseUrl,
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
        return "openai";
    }

    @Override
    public boolean supportsModel(String model) {
        return model.startsWith("gpt-") || model.startsWith("o1-") || model.startsWith("o3-");
    }

    @Override
    public LlmResponse chat(LlmRequest request) {
        String resolvedModel = request.model();

        try {
            ObjectNode body = mapper.createObjectNode();
            body.put("model", resolvedModel);
            body.put("temperature", request.temperature());
            body.put("max_tokens", request.maxTokens());

            ArrayNode messagesNode = body.putArray("messages");
            for (LlmRequest.ChatMessage msg : request.messages()) {
                ObjectNode msgNode = messagesNode.addObject();
                msgNode.put("role", msg.role());
                msgNode.put("content", msg.content());
            }

            String jsonBody = mapper.writeValueAsString(body);

            Request httpRequest = new Request.Builder()
                    .url(baseUrl + "/chat/completions")
                    .addHeader("Authorization", "Bearer " + apiKey)
                    .addHeader("Content-Type", "application/json")
                    .post(RequestBody.create(jsonBody, MediaType.parse("application/json")))
                    .build();

            try (Response response = httpClient.newCall(httpRequest).execute()) {
                String responseBody = response.body() != null ? response.body().string() : "";

                if (!response.isSuccessful()) {
                    log.error("OpenAI API error: status={}, body={}", response.code(), responseBody);
                    throw new RuntimeException("OpenAI API error: " + response.code());
                }

                JsonNode root = mapper.readTree(responseBody);
                JsonNode choice = root.path("choices").path(0);
                JsonNode usage = root.path("usage");

                return new LlmResponse(
                        root.path("id").asText(),
                        root.path("model").asText(),
                        choice.path("message").path("content").asText(),
                        choice.path("finish_reason").asText("stop"),
                        new LlmResponse.TokenUsage(
                                usage.path("prompt_tokens").asInt(0),
                                usage.path("completion_tokens").asInt(0),
                                usage.path("total_tokens").asInt(0)
                        ),
                        Map.of()
                );
            }
        } catch (IOException e) {
            log.error("Failed to call OpenAI API: {}", e.getMessage(), e);
            throw new RuntimeException("OpenAI API call failed", e);
        }
    }
}
