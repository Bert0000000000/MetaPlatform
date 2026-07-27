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
 * TECH-AGENT 服务客户端。
 *
 * <p>对应 Python {@code app.clients.agent_service_client.AgentServiceClient}。
 * 调用 TECH-AGENT 的执行接口，将 A2A 任务路由到内部 Agent 执行。
 * 当 {@code mate.a2a.agent-service-base-url} 为空时，返回 mock 响应。</p>
 */
@Slf4j
@Component
public class AgentServiceClient {

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

    private final WebClient webClient;
    private final A2aProperties properties;
    private final ObjectMapper objectMapper;

    public AgentServiceClient(@Qualifier("agentServiceWebClient") WebClient webClient,
                              A2aProperties properties,
                              ObjectMapper objectMapper) {
        this.webClient = webClient;
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    /**
     * 调用 TECH-AGENT 执行任务。
     *
     * @param agentCode Agent code
     * @param input     输入内容
     * @return 执行结果（含 output / status）
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> execute(String agentCode, String input) {
        String baseUrl = properties.getAgentServiceBaseUrl();
        if (baseUrl == null || baseUrl.isBlank()) {
            return mockExecute(agentCode, input);
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("agentCode", agentCode);
        payload.put("input", input);

        String traceId = TenantContext.getTraceId();

        try {
            String json = webClient.post()
                    .uri("/api/v1/agent/execute")
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
            log.error("TECH-AGENT 调用失败 | agent={} status={}",
                    agentCode, ex.getStatusCode(), ex);
            throw A2aException.upstreamUnavailable(
                    "TECH-AGENT 调用失败: " + ex.getMessage());
        } catch (Exception ex) {
            log.error("TECH-AGENT 调用异常 | agent={}", agentCode, ex);
            throw A2aException.upstreamUnavailable(
                    "TECH-AGENT 调用失败: " + ex.getMessage());
        }
    }

    /**
     * 查询 Agent 执行状态。
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getStatus(String executionId) {
        String baseUrl = properties.getAgentServiceBaseUrl();
        if (baseUrl == null || baseUrl.isBlank()) {
            Map<String, Object> result = new HashMap<>();
            result.put("executionId", executionId);
            result.put("status", "COMPLETED");
            result.put("output", "[mock] 执行完成");
            return result;
        }

        try {
            String json = webClient.get()
                    .uri("/api/v1/agent/executions/" + executionId)
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
            log.error("TECH-AGENT 状态查询失败 | exec={} status={}",
                    executionId, ex.getStatusCode(), ex);
            throw A2aException.upstreamUnavailable(
                    "TECH-AGENT 状态查询失败: " + ex.getMessage());
        } catch (Exception ex) {
            log.error("TECH-AGENT 状态查询异常 | exec={}", executionId, ex);
            throw A2aException.upstreamUnavailable(
                    "TECH-AGENT 状态查询失败: " + ex.getMessage());
        }
    }

    // ----------------------------------------------------------- mock helpers

    private Map<String, Object> mockExecute(String agentCode, String input) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("executionId", "exec-mock-" + System.nanoTime());
        result.put("agentCode", agentCode);
        result.put("status", "COMPLETED");
        result.put("output", "[mock] 已执行: " + (input == null ? "" : input));
        return result;
    }
}
