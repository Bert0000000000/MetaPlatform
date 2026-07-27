package com.metaplatform.a2a.clients;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.a2a.common.TenantContext;
import com.metaplatform.a2a.config.A2aProperties;
import com.metaplatform.a2a.exception.A2aException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 外部 A2A Agent 客户端。
 *
 * <p>对应 Python {@code app.clients.agent_client.AgentClient}。
 * 通过 JSON-RPC 2.0 调用外部 A2A Agent（{@code tasks/send} / {@code tasks/get} / {@code tasks/cancel}）。
 * 当 {@code mate.a2a.agent-base-url} 为空时，返回确定性 mock 响应。</p>
 */
@Slf4j
@Component
public class AgentClient {

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

    private final WebClient webClient;
    private final A2aProperties properties;
    private final ObjectMapper objectMapper;

    public AgentClient(@Qualifier("agentWebClient") WebClient webClient,
                       A2aProperties properties,
                       ObjectMapper objectMapper) {
        this.webClient = webClient;
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    /**
     * 发送任务到外部 A2A Agent（JSON-RPC tasks/send）。
     *
     * @param targetAgentId 目标 Agent ID
     * @param payload       任务负载
     * @return Agent 响应（含 task id / status / artifacts）
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> sendTask(String targetAgentId, Map<String, Object> payload) {
        String baseUrl = properties.getAgentBaseUrl();
        if (baseUrl == null || baseUrl.isBlank()) {
            return mockSendTask(targetAgentId, payload);
        }

        Map<String, Object> jsonrpc = buildJsonRpcRequest("tasks/send", payload);
        String traceId = TenantContext.getTraceId();
        if (traceId != null) {
            jsonrpc.put("trace_id", traceId);
        }

        try {
            String json = webClient.post()
                    .uri("/tasks/send")
                    .header(HttpHeaders.CONTENT_TYPE, "application/json")
                    .header("X-Trace-Id", traceId == null ? "" : traceId)
                    .bodyValue(jsonrpc)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
            Map<String, Object> resp = objectMapper.readValue(json, MAP_TYPE);
            // JSON-RPC 响应包裹在 result 中
            Object result = resp.get("result");
            if (result instanceof Map) {
                return (Map<String, Object>) result;
            }
            return resp;
        } catch (WebClientResponseException ex) {
            log.error("A2A Agent 调用失败 | agent={} status={}", targetAgentId, ex.getStatusCode(), ex);
            throw A2aException.upstreamUnavailable(
                    "外部 A2A Agent 调用失败: " + ex.getMessage());
        } catch (Exception ex) {
            log.error("A2A Agent 调用异常 | agent={}", targetAgentId, ex);
            throw A2aException.upstreamUnavailable(
                    "外部 A2A Agent 调用失败: " + ex.getMessage());
        }
    }

    /**
     * 查询任务状态（JSON-RPC tasks/get）。
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getTask(String targetAgentId, String taskId) {
        String baseUrl = properties.getAgentBaseUrl();
        if (baseUrl == null || baseUrl.isBlank()) {
            return mockGetTask(targetAgentId, taskId);
        }

        Map<String, Object> params = new HashMap<>();
        params.put("id", taskId);
        Map<String, Object> jsonrpc = buildJsonRpcRequest("tasks/get", params);

        try {
            String json = webClient.post()
                    .uri("/tasks/get")
                    .header(HttpHeaders.CONTENT_TYPE, "application/json")
                    .bodyValue(jsonrpc)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
            Map<String, Object> resp = objectMapper.readValue(json, MAP_TYPE);
            Object result = resp.get("result");
            if (result instanceof Map) {
                return (Map<String, Object>) result;
            }
            return resp;
        } catch (WebClientResponseException ex) {
            log.error("A2A Agent 查询失败 | agent={} task={} status={}",
                    targetAgentId, taskId, ex.getStatusCode(), ex);
            throw A2aException.upstreamUnavailable(
                    "外部 A2A Agent 查询失败: " + ex.getMessage());
        } catch (Exception ex) {
            log.error("A2A Agent 查询异常 | agent={} task={}", targetAgentId, taskId, ex);
            throw A2aException.upstreamUnavailable(
                    "外部 A2A Agent 查询失败: " + ex.getMessage());
        }
    }

    /**
     * 取消任务（JSON-RPC tasks/cancel）。
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> cancelTask(String targetAgentId, String taskId) {
        String baseUrl = properties.getAgentBaseUrl();
        if (baseUrl == null || baseUrl.isBlank()) {
            Map<String, Object> result = new HashMap<>();
            result.put("id", taskId);
            result.put("status", "CANCELED");
            return result;
        }

        Map<String, Object> params = new HashMap<>();
        params.put("id", taskId);
        Map<String, Object> jsonrpc = buildJsonRpcRequest("tasks/cancel", params);

        try {
            String json = webClient.post()
                    .uri("/tasks/cancel")
                    .header(HttpHeaders.CONTENT_TYPE, "application/json")
                    .bodyValue(jsonrpc)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
            Map<String, Object> resp = objectMapper.readValue(json, MAP_TYPE);
            Object result = resp.get("result");
            if (result instanceof Map) {
                return (Map<String, Object>) result;
            }
            return resp;
        } catch (WebClientResponseException ex) {
            log.error("A2A Agent 取消失败 | agent={} task={} status={}",
                    targetAgentId, taskId, ex.getStatusCode(), ex);
            throw A2aException.upstreamUnavailable(
                    "外部 A2A Agent 取消失败: " + ex.getMessage());
        } catch (Exception ex) {
            log.error("A2A Agent 取消异常 | agent={} task={}", targetAgentId, taskId, ex);
            throw A2aException.upstreamUnavailable(
                    "外部 A2A Agent 取消失败: " + ex.getMessage());
        }
    }

    // ----------------------------------------------------------- JSON-RPC helpers

    private Map<String, Object> buildJsonRpcRequest(String method, Map<String, Object> params) {
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("jsonrpc", "2.0");
        request.put("method", method);
        request.put("params", params);
        request.put("id", java.util.UUID.randomUUID().toString());
        return request;
    }

    // ----------------------------------------------------------- mock helpers

    private Map<String, Object> mockSendTask(String targetAgentId, Map<String, Object> payload) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", "task-mock-" + System.nanoTime());
        result.put("state", Map.of(
                "agent_id", targetAgentId,
                "status", "COMPLETED"));
        Object input = payload.get("message");
        Map<String, Object> artifacts = new HashMap<>();
        if (input instanceof Map<?, ?> inputMap) {
            Object text = inputMap.get("content");
            artifacts.put("parts", List.of(Map.of("type", "text",
                    "text", "[mock] 已收到: " + (text == null ? "" : text))));
        } else {
            artifacts.put("parts", List.of(Map.of("type", "text",
                    "text", "[mock] 已收到任务")));
        }
        result.put("artifacts", List.of(artifacts));
        return result;
    }

    private Map<String, Object> mockGetTask(String targetAgentId, String taskId) {
        Map<String, Object> result = new HashMap<>();
        result.put("id", taskId);
        result.put("state", Map.of(
                "agent_id", targetAgentId,
                "status", "COMPLETED"));
        return result;
    }
}
