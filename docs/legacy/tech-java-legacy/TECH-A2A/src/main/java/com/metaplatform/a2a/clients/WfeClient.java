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
import java.util.Map;

/**
 * TECH-WFE 服务客户端。
 *
 * <p>对应 Python {@code app.clients.wfe_client.WfeClient}。
 * 调用 TECH-WFE 的工作流执行接口，将 A2A 任务路由到 BPMN 工作流执行。
 * 当 {@code mate.a2a.wfe-base-url} 为空时，返回 mock 响应。</p>
 */
@Slf4j
@Component
public class WfeClient {

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

    private final WebClient webClient;
    private final A2aProperties properties;
    private final ObjectMapper objectMapper;

    public WfeClient(@Qualifier("wfeWebClient") WebClient webClient,
                     A2aProperties properties,
                     ObjectMapper objectMapper) {
        this.webClient = webClient;
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    /**
     * 启动工作流。
     *
     * @param workflowCode 工作流 code
     * @param variables   流程变量
     * @return 执行结果（含 executionId / status）
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> startWorkflow(String workflowCode, Map<String, Object> variables) {
        String baseUrl = properties.getWfeBaseUrl();
        if (baseUrl == null || baseUrl.isBlank()) {
            return mockStart(workflowCode, variables);
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("workflowCode", workflowCode);
        payload.put("variables", variables);

        String traceId = TenantContext.getTraceId();

        try {
            String json = webClient.post()
                    .uri("/api/v1/wfe/executions")
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
            log.error("TECH-WFE 启动工作流失败 | workflow={} status={}",
                    workflowCode, ex.getStatusCode(), ex);
            throw A2aException.upstreamUnavailable(
                    "TECH-WFE 启动工作流失败: " + ex.getMessage());
        } catch (Exception ex) {
            log.error("TECH-WFE 启动工作流异常 | workflow={}", workflowCode, ex);
            throw A2aException.upstreamUnavailable(
                    "TECH-WFE 启动工作流失败: " + ex.getMessage());
        }
    }

    /**
     * 查询工作流执行状态。
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getExecutionStatus(String executionId) {
        String baseUrl = properties.getWfeBaseUrl();
        if (baseUrl == null || baseUrl.isBlank()) {
            Map<String, Object> result = new HashMap<>();
            result.put("executionId", executionId);
            result.put("status", "COMPLETED");
            return result;
        }

        try {
            String json = webClient.get()
                    .uri("/api/v1/wfe/executions/" + executionId)
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
            log.error("TECH-WFE 状态查询失败 | exec={} status={}",
                    executionId, ex.getStatusCode(), ex);
            throw A2aException.upstreamUnavailable(
                    "TECH-WFE 状态查询失败: " + ex.getMessage());
        } catch (Exception ex) {
            log.error("TECH-WFE 状态查询异常 | exec={}", executionId, ex);
            throw A2aException.upstreamUnavailable(
                    "TECH-WFE 状态查询失败: " + ex.getMessage());
        }
    }

    // ----------------------------------------------------------- mock helpers

    private Map<String, Object> mockStart(String workflowCode, Map<String, Object> variables) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("executionId", "wfe-mock-" + System.nanoTime());
        result.put("workflowCode", workflowCode);
        result.put("status", "COMPLETED");
        return result;
    }
}
