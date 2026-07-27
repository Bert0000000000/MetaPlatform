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

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * TECH-ACTION 服务客户端。
 *
 * <p>当 {@code mate.agent.action-base-url} 为空时，返回确定性 mock 响应，
 * 使执行引擎在没有上游服务时也能运行。</p>
 */
@Slf4j
@Component
public class ActionClient {

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

    private final WebClient webClient;
    private final AgentProperties properties;
    private final ObjectMapper objectMapper;

    public ActionClient(@Qualifier("actionWebClient") WebClient webClient,
                        AgentProperties properties,
                        ObjectMapper objectMapper) {
        this.webClient = webClient;
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    /**
     * 同步执行指定 Action。
     *
     * @param actionCode Action 编码
     * @param input      输入参数
     * @param tenantId   租户 ID
     * @param traceId    链路追踪 ID（可空）
     * @return Action 执行结果（包含 output 字段）
     */
    public Map<String, Object> execute(String actionCode,
                                       Map<String, Object> input,
                                       String tenantId,
                                       String traceId) {
        String baseUrl = properties.getActionBaseUrl();
        if (baseUrl == null || baseUrl.isBlank()) {
            return mockExecute(actionCode, input);
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("actionCode", actionCode);
        payload.put("input", input);

        try {
            String json = webClient.post()
                    .uri("/api/v1/action/executions/sync")
                    .header(HttpHeaders.CONTENT_TYPE, "application/json")
                    .header("X-Tenant-Id", tenantId == null ? "" : tenantId)
                    .header("X-Trace-Id", traceId == null ? "" : traceId)
                    .bodyValue(payload)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
            Map<String, Object> envelope = objectMapper.readValue(json, MAP_TYPE);
            Object data = envelope.get("data");
            if (data instanceof Map<?, ?> dataMap) {
                @SuppressWarnings("unchecked")
                Map<String, Object> result = (Map<String, Object>) data;
                return result;
            }
            return envelope;
        } catch (WebClientResponseException ex) {
            log.error("Action 调用失败 | actionCode={} status={}", actionCode, ex.getStatusCode(), ex);
            throw new AgentException(ErrorCode.ACTION_UNAVAILABLE,
                    "Action 调用失败: " + ex.getMessage(), ex);
        } catch (Exception ex) {
            log.error("Action 调用异常 | actionCode={}", actionCode, ex);
            throw new AgentException(ErrorCode.ACTION_UNAVAILABLE,
                    "Action 调用失败: " + ex.getMessage(), ex);
        }
    }

    /**
     * 列出可用 Actions。
     */
    public List<Map<String, Object>> listActions(String tenantId, String traceId) {
        String baseUrl = properties.getActionBaseUrl();
        if (baseUrl == null || baseUrl.isBlank()) {
            return mockListActions();
        }

        try {
            String json = webClient.get()
                    .uri("/api/v1/action/actions")
                    .header("X-Tenant-Id", tenantId == null ? "" : tenantId)
                    .header("X-Trace-Id", traceId == null ? "" : traceId)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
            Map<String, Object> envelope = objectMapper.readValue(json, MAP_TYPE);
            Object data = envelope.get("data");
            if (data instanceof Map<?, ?> dataMap) {
                Object items = dataMap.get("items");
                if (items instanceof List<?> itemList) {
                    return castToListMap(itemList);
                }
            } else if (data instanceof List<?> dataList) {
                return castToListMap(dataList);
            }
            return List.of();
        } catch (WebClientResponseException ex) {
            log.error("Action 列表查询失败 | status={}", ex.getStatusCode(), ex);
            throw new AgentException(ErrorCode.ACTION_UNAVAILABLE,
                    "Action 列表查询失败: " + ex.getMessage(), ex);
        } catch (Exception ex) {
            log.error("Action 列表查询异常", ex);
            throw new AgentException(ErrorCode.ACTION_UNAVAILABLE,
                    "Action 列表查询失败: " + ex.getMessage(), ex);
        }
    }

    /**
     * 获取单个 Action 详情（含 input/output schema）。
     */
    public Map<String, Object> getAction(String actionCode, String tenantId, String traceId) {
        String baseUrl = properties.getActionBaseUrl();
        if (baseUrl == null || baseUrl.isBlank()) {
            return mockGetAction(actionCode);
        }

        try {
            String json = webClient.get()
                    .uri("/api/v1/action/actions/{code}", actionCode)
                    .header("X-Tenant-Id", tenantId == null ? "" : tenantId)
                    .header("X-Trace-Id", traceId == null ? "" : traceId)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
            Map<String, Object> envelope = objectMapper.readValue(json, MAP_TYPE);
            Object data = envelope.get("data");
            if (data instanceof Map<?, ?> dataMap) {
                @SuppressWarnings("unchecked")
                Map<String, Object> result = (Map<String, Object>) data;
                return result;
            }
            return envelope;
        } catch (WebClientResponseException ex) {
            log.error("Action 详情查询失败 | actionCode={} status={}", actionCode, ex.getStatusCode(), ex);
            throw new AgentException(ErrorCode.ACTION_UNAVAILABLE,
                    "Action 详情查询失败: " + ex.getMessage(), ex);
        } catch (Exception ex) {
            log.error("Action 详情查询异常 | actionCode={}", actionCode, ex);
            throw new AgentException(ErrorCode.ACTION_UNAVAILABLE,
                    "Action 详情查询失败: " + ex.getMessage(), ex);
        }
    }

    /**
     * 将 Action 定义转换为 LLM function-calling 定义。
     */
    public Map<String, Object> toFunctionDefinition(String actionCode, Map<String, Object> actionMeta) {
        String desc = (String) actionMeta.getOrDefault("description", "Execute action: " + actionCode);
        Object inputSchema = actionMeta.get("inputSchema");
        if (inputSchema == null) {
            inputSchema = Map.of("type", "object", "properties", Map.of());
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("name", actionCode);
        result.put("description", desc);
        result.put("parameters", inputSchema);
        return result;
    }

    // ----------------------------------------------------------- mock helpers

    private Map<String, Object> mockExecute(String actionCode, Map<String, Object> inputData) {
        Map<String, Object> output = new LinkedHashMap<>();
        output.put("result", "Action '" + actionCode + "' executed successfully (mock)");
        output.put("inputEcho", inputData);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("executionId", "act-exec-mock-" + actionCode);
        result.put("actionId", "act-" + actionCode);
        result.put("actionCode", actionCode);
        result.put("status", "SUCCESS");
        result.put("output", output);
        return result;
    }

    private List<Map<String, Object>> mockListActions() {
        Map<String, Object> a1 = new LinkedHashMap<>();
        a1.put("actionCode", "query-order-status");
        a1.put("name", "查询订单状态");
        a1.put("description", "根据订单号查询采购订单的当前状态");
        a1.put("inputSchema", Map.of(
                "type", "object",
                "properties", Map.of("orderNo", Map.of("type", "string", "description", "订单编号")),
                "required", List.of("orderNo")));

        Map<String, Object> a2 = new LinkedHashMap<>();
        a2.put("actionCode", "search-knowledge");
        a2.put("name", "搜索知识库");
        a2.put("description", "在知识库中检索相关文档");
        a2.put("inputSchema", Map.of(
                "type", "object",
                "properties", Map.of("query", Map.of("type", "string", "description", "检索关键词")),
                "required", List.of("query")));

        return List.of(a1, a2);
    }

    private Map<String, Object> mockGetAction(String actionCode) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("actionCode", actionCode);
        result.put("name", actionCode);
        result.put("description", "Mock action: " + actionCode);
        result.put("inputSchema", Map.of(
                "type", "object",
                "properties", Map.of("input", Map.of("type", "string", "description", "输入参数"))));
        result.put("outputSchema", Map.of(
                "type", "object",
                "properties", Map.of("result", Map.of("type", "string"))));
        return result;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> castToListMap(List<?> list) {
        return list.stream()
                .filter(item -> item instanceof Map<?, ?>)
                .map(item -> (Map<String, Object>) item)
                .toList();
    }
}
