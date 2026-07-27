package com.metaplatform.agent.clients;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.agent.common.ErrorCode;
import com.metaplatform.agent.config.AgentProperties;
import com.metaplatform.agent.exception.AgentException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Flux;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * TECH-LLMGW 服务客户端。
 *
 * <p>所有 LLM 调用（chat / streaming / embeddings）都通过此网关。
 * 当 {@code mate.agent.llmgw-base-url} 为空时，返回基于 SHA256 的确定性 mock 响应，
 * 使执行引擎在没有上游服务时也能运行。</p>
 */
@Slf4j
@Component
public class LLMGWClient {

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

    private final WebClient webClient;
    private final AgentProperties properties;
    private final ObjectMapper objectMapper;

    public LLMGWClient(@Qualifier("llmgwWebClient") WebClient webClient,
                       AgentProperties properties,
                       ObjectMapper objectMapper) {
        this.webClient = webClient;
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    /**
     * 同步对话补全。
     *
     * @param modelId     模型 ID
     * @param messages    消息列表（role/content）
     * @param temperature 温度
     * @param maxTokens   最大 token 数（可空）
     * @param functions   函数定义列表（可空，启用 function calling）
     * @param traceId     链路追踪 ID（可空）
     * @return LLM 响应（含 choices / usage）
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> chat(String modelId,
                                    List<Map<String, Object>> messages,
                                    double temperature,
                                    Integer maxTokens,
                                    List<Map<String, Object>> functions,
                                    String traceId) {
        String baseUrl = properties.getLlmgwBaseUrl();
        if (baseUrl == null || baseUrl.isBlank()) {
            return mockChat(modelId, messages, functions);
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("model", modelId);
        payload.put("messages", messages);
        payload.put("temperature", temperature);
        if (maxTokens != null) {
            payload.put("maxTokens", maxTokens);
        }
        if (functions != null && !functions.isEmpty()) {
            payload.put("functions", functions);
        }

        try {
            String json = webClient.post()
                    .uri("/api/v1/llmgw/chat/completions")
                    .header(HttpHeaders.CONTENT_TYPE, "application/json")
                    .header("X-Trace-Id", traceId == null ? "" : traceId)
                    .bodyValue(payload)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
            Map<String, Object> envelope = objectMapper.readValue(json, MAP_TYPE);
            Object data = envelope.get("data");
            if (data instanceof Map) {
                return (Map<String, Object>) data;
            }
            return envelope;
        } catch (WebClientResponseException ex) {
            log.error("LLMGW 调用失败 | model={} status={}", modelId, ex.getStatusCode(), ex);
            throw new AgentException(ErrorCode.LLMGW_UNAVAILABLE,
                    "LLM Gateway 调用失败: " + ex.getMessage(), ex);
        } catch (Exception ex) {
            log.error("LLMGW 调用异常 | model={}", modelId, ex);
            throw new AgentException(ErrorCode.LLMGW_UNAVAILABLE,
                    "LLM Gateway 调用失败: " + ex.getMessage(), ex);
        }
    }

    /**
     * 流式对话补全。
     *
     * @return Flux of delta chunks: {@code {"delta": str, "finish_reason": str|None}}
     */
    public Flux<Map<String, Object>> streamChat(String modelId,
                                                List<Map<String, Object>> messages,
                                                double temperature,
                                                Integer maxTokens,
                                                String traceId) {
        String baseUrl = properties.getLlmgwBaseUrl();
        if (baseUrl == null || baseUrl.isBlank()) {
            return Flux.fromIterable(mockStream(modelId, messages));
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("model", modelId);
        payload.put("messages", messages);
        payload.put("temperature", temperature);
        payload.put("stream", true);
        if (maxTokens != null) {
            payload.put("maxTokens", maxTokens);
        }

        return webClient.post()
                .uri("/api/v1/llmgw/chat/completions")
                .header(HttpHeaders.CONTENT_TYPE, "application/json")
                .header("X-Trace-Id", traceId == null ? "" : traceId)
                .bodyValue(payload)
                .retrieve()
                .bodyToFlux(String.class)
                .filter(line -> line != null && !line.isBlank() && line.startsWith("data: "))
                .mapNotNull(line -> {
                    try {
                        Map<String, Object> data = objectMapper.readValue(line.substring(6), MAP_TYPE);
                        Object choicesObj = data.get("choices");
                        if (choicesObj instanceof List<?> choices && !choices.isEmpty()) {
                            Object choice = choices.get(0);
                            if (choice instanceof Map<?, ?> choiceMap) {
                                Map<String, Object> result = new HashMap<>();
                                Object delta = choiceMap.get("delta");
                                String content = "";
                                if (delta instanceof Map<?, ?> deltaMap) {
                                    Object c = deltaMap.get("content");
                                    content = c == null ? "" : c.toString();
                                }
                                result.put("delta", content);
                                result.put("finish_reason", choiceMap.get("finish_reason"));
                                return result;
                            }
                        }
                        return null;
                    } catch (Exception e) {
                        return null;
                    }
                })
                .onErrorResume(WebClientResponseException.class, ex -> {
                    log.error("LLMGW 流式调用失败 | model={}", modelId, ex);
                    return Flux.error(new AgentException(ErrorCode.LLMGW_UNAVAILABLE,
                            "LLM Gateway 流式调用失败: " + ex.getMessage(), ex));
                });
    }

    /**
     * 生成文本向量。
     *
     * @return 向量列表
     */
    public List<List<Double>> embed(String modelId, List<String> texts, String traceId) {
        String baseUrl = properties.getLlmgwBaseUrl();
        if (baseUrl == null || baseUrl.isBlank()) {
            return mockEmbed(modelId, texts);
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("model", modelId);
        payload.put("input", texts);

        try {
            String json = webClient.post()
                    .uri("/api/v1/llmgw/embeddings")
                    .header(HttpHeaders.CONTENT_TYPE, "application/json")
                    .header("X-Trace-Id", traceId == null ? "" : traceId)
                    .bodyValue(payload)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
            Map<String, Object> envelope = objectMapper.readValue(json, MAP_TYPE);
            Object data = envelope.get("data");
            if (data instanceof Map<?, ?> dataMap) {
                Object embeddings = dataMap.get("embeddings");
                if (embeddings instanceof List<?> embList) {
                    List<List<Double>> result = new ArrayList<>();
                    for (Object item : embList) {
                        if (item instanceof Map<?, ?> embMap) {
                            Object vec = embMap.get("embedding");
                            if (vec instanceof List<?> vecList) {
                                List<Double> doubleVec = new ArrayList<>();
                                for (Object v : vecList) {
                                    doubleVec.add(((Number) v).doubleValue());
                                }
                                result.add(doubleVec);
                            }
                        }
                    }
                    return result;
                }
            }
            return List.of();
        } catch (WebClientResponseException ex) {
            log.error("LLMGW Embedding 调用失败 | model={}", modelId, ex);
            throw new AgentException(ErrorCode.LLMGW_UNAVAILABLE,
                    "LLM Gateway Embedding 调用失败: " + ex.getMessage(), ex);
        } catch (Exception ex) {
            log.error("LLMGW Embedding 调用异常 | model={}", modelId, ex);
            throw new AgentException(ErrorCode.LLMGW_UNAVAILABLE,
                    "LLM Gateway Embedding 调用失败: " + ex.getMessage(), ex);
        }
    }

    // ----------------------------------------------------------- mock helpers

    private Map<String, Object> mockChat(String modelId,
                                         List<Map<String, Object>> messages,
                                         List<Map<String, Object>> functions) {
        String userText = "";
        for (Map<String, Object> m : messages) {
            if ("user".equals(m.get("role"))) {
                Object content = m.get("content");
                userText = content == null ? "" : content.toString();
                break;
            }
        }
        String seed = modelId + ":" + userText;
        String digest = sha256Hex(seed).substring(0, 16);

        if (functions != null && !functions.isEmpty()) {
            @SuppressWarnings("unchecked")
            Map<String, Object> fn = functions.get(0);
            String fnName = (String) fn.getOrDefault("name", "tool");
            String answer = "已收到任务：" + userText + "\n（模拟模式，建议调用工具: " + fnName + "）";

            Map<String, Object> functionCall = new LinkedHashMap<>();
            functionCall.put("name", fnName);
            functionCall.put("arguments", "{\"input\": \"" + userText + "\"}");

            Map<String, Object> message = new LinkedHashMap<>();
            message.put("role", "assistant");
            message.put("content", answer);
            message.put("function_call", functionCall);

            Map<String, Object> choice = new LinkedHashMap<>();
            choice.put("index", 0);
            choice.put("message", message);
            choice.put("finish_reason", "function_call");

            Map<String, Object> usage = new LinkedHashMap<>();
            usage.put("promptTokens", userText.length());
            usage.put("completionTokens", answer.length());

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("id", "chat-mock-" + digest);
            result.put("model", modelId);
            result.put("choices", List.of(choice));
            result.put("usage", usage);
            return result;
        }

        String answer = "已收到任务：" + userText + "\n（当前为模拟模式，未调用真实模型；seed=" + digest + "）";

        Map<String, Object> message = new LinkedHashMap<>();
        message.put("role", "assistant");
        message.put("content", answer);

        Map<String, Object> choice = new LinkedHashMap<>();
        choice.put("index", 0);
        choice.put("message", message);
        choice.put("finish_reason", "stop");

        Map<String, Object> usage = new LinkedHashMap<>();
        usage.put("promptTokens", userText.length());
        usage.put("completionTokens", answer.length());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", "chat-mock-" + digest);
        result.put("model", modelId);
        result.put("choices", List.of(choice));
        result.put("usage", usage);
        return result;
    }

    private List<Map<String, Object>> mockStream(String modelId, List<Map<String, Object>> messages) {
        String userText = "";
        for (Map<String, Object> m : messages) {
            if ("user".equals(m.get("role"))) {
                Object content = m.get("content");
                userText = content == null ? "" : content.toString();
                break;
            }
        }
        String answer = "已收到任务：" + userText + "（模拟流式输出）";
        List<Map<String, Object>> chunks = new ArrayList<>();
        for (String word : answer.split(" ")) {
            Map<String, Object> chunk = new HashMap<>();
            chunk.put("delta", word + " ");
            chunk.put("finish_reason", null);
            chunks.add(chunk);
        }
        Map<String, Object> done = new HashMap<>();
        done.put("delta", "");
        done.put("finish_reason", "stop");
        chunks.add(done);
        return chunks;
    }

    private List<List<Double>> mockEmbed(String modelId, List<String> texts) {
        List<List<Double>> results = new ArrayList<>();
        for (String text : texts) {
            String seed = modelId + ":" + text;
            String hex = sha256Hex(seed).substring(0, 8);
            int seedInt = (int) Long.parseLong(hex, 16);
            java.util.Random rng = new java.util.Random(seedInt);
            List<Double> vec = new ArrayList<>();
            for (int i = 0; i < 8; i++) {
                vec.add(rng.nextDouble() * 2.0 - 1.0);
            }
            results.add(vec);
        }
        return results;
    }

    private static String sha256Hex(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) {
                    hexString.append('0');
                }
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException(e);
        }
    }
}
