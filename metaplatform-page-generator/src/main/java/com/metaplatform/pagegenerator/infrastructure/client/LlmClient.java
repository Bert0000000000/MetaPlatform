package com.metaplatform.pagegenerator.infrastructure.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

/**
 * LLM REST 客户端 - 调用 AI Substrate 的 LLM Gateway
 */
@Component
public class LlmClient {

    private static final Logger log = LoggerFactory.getLogger(LlmClient.class);

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final String baseUrl;

    public LlmClient(RestTemplate restTemplate,
                      ObjectMapper objectMapper,
                      @Value("${services.ai-substrate.base-url:http://localhost:8082}") String baseUrl) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
        this.baseUrl = baseUrl;
    }

    /**
     * 调用 LLM 聊天完成接口
     *
     * @param systemPrompt 系统提示词
     * @param userMessage  用户消息
     * @param model        模型名称
     * @param temperature  温度参数
     * @return LLM 响应文本
     */
    public String chatCompletion(String systemPrompt, String userMessage,
                                  String model, double temperature) {
        try {
            String url = baseUrl + "/api/v1/llm/chat";

            Map<String, Object> requestBody = Map.of(
                    "model", model != null ? model : "gpt-4o",
                    "messages", new Object[]{
                            Map.of("role", "system", "content", systemPrompt),
                            Map.of("role", "user", "content", userMessage)
                    },
                    "temperature", temperature,
                    "responseFormat", Map.of("type", "json_object")
            );

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

            ResponseEntity<String> response = restTemplate.exchange(
                    url, HttpMethod.POST, entity, String.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                // 解析 OpenAI 兼容格式
                if (root.has("choices") && root.get("choices").isArray() && root.get("choices").size() > 0) {
                    JsonNode message = root.get("choices").get(0).get("message");
                    if (message != null && message.has("content")) {
                        return message.get("content").asText();
                    }
                }
                // 直接返回 content 字段
                if (root.has("content")) {
                    return root.get("content").asText();
                }
                return response.getBody();
            }

            throw new RuntimeException("LLM request failed with status: " + response.getStatusCode());
        } catch (Exception e) {
            log.warn("Failed to call LLM service: {}", e.getMessage());
            throw new RuntimeException("LLM service unavailable: " + e.getMessage(), e);
        }
    }
}
