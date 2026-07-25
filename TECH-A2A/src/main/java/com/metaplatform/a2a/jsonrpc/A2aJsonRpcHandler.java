package com.metaplatform.a2a.jsonrpc;

import com.metaplatform.a2a.common.TenantContext;
import com.metaplatform.a2a.inbound.InboundTaskService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
@RequiredArgsConstructor
public class A2aJsonRpcHandler {

    private final InboundTaskService taskExecutionService;

    public JsonRpcResponse handle(JsonRpcRequest request) {
        if (!"2.0".equals(request.getJsonrpc())) {
            return JsonRpcResponse.error(request.getId(), -32600, "Invalid JSON-RPC version");
        }

        return switch (request.getMethod()) {
            case "tasks/send" -> handleTaskSend(request);
            case "tasks/sendSubscribe" -> handleTaskSendSubscribe(request);
            case "tasks/get" -> handleTaskGet(request);
            case "tasks/cancel" -> handleTaskCancel(request);
            default -> JsonRpcResponse.error(request.getId(), -32601,
                    "Method not found: " + request.getMethod());
        };
    }

    private JsonRpcResponse handleTaskSend(JsonRpcRequest request) {
        Map<String, Object> params = params(request);
        Map<String, Object> result = taskExecutionService.handleSend(
                TenantContext.getTenantIdOrDefault(),
                stringValue(params, "source_agent_id", "sourceAgentId"),
                stringValue(params, "target_agent_id", "targetAgentId"),
                request.getId() != null ? request.getId().toString() : null,
                payload(params));
        return fromLegacyResponse(request.getId(), result);
    }

    private JsonRpcResponse handleTaskSendSubscribe(JsonRpcRequest request) {
        Map<String, Object> params = params(request);
        Map<String, Object> payload = payload(params);
        payload.put("streaming", true);
        Map<String, Object> result = taskExecutionService.handleSend(
                TenantContext.getTenantIdOrDefault(),
                stringValue(params, "source_agent_id", "sourceAgentId"),
                stringValue(params, "target_agent_id", "targetAgentId"),
                request.getId() != null ? request.getId().toString() : null,
                payload);
        return fromLegacyResponse(request.getId(), result);
    }

    private JsonRpcResponse handleTaskGet(JsonRpcRequest request) {
        Map<String, Object> result = taskExecutionService.handleGet(
                TenantContext.getTenantIdOrDefault(),
                stringValue(params(request), "task_id", "id"),
                request.getId() != null ? request.getId().toString() : null);
        return fromLegacyResponse(request.getId(), result);
    }

    private JsonRpcResponse handleTaskCancel(JsonRpcRequest request) {
        Map<String, Object> result = taskExecutionService.handleCancel(
                TenantContext.getTenantIdOrDefault(),
                stringValue(params(request), "task_id", "id"),
                request.getId() != null ? request.getId().toString() : null);
        return fromLegacyResponse(request.getId(), result);
    }

    private JsonRpcResponse fromLegacyResponse(Object id, Map<String, Object> response) {
        Object error = response.get("error");
        if (error instanceof Map<?, ?> errorMap) {
            Object code = errorMap.get("code");
            int errorCode = code instanceof Number number ? number.intValue() : -32603;
            return JsonRpcResponse.error(id, errorCode, String.valueOf(errorMap.get("message")));
        }
        return JsonRpcResponse.success(id, response.get("result"));
    }

    private Map<String, Object> params(JsonRpcRequest request) {
        return request.getParams() != null ? request.getParams() : Map.of();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> payload(Map<String, Object> params) {
        Object payload = params.get("payload");
        if (payload instanceof Map<?, ?> map) {
            return new java.util.LinkedHashMap<>((Map<String, Object>) map);
        }
        return new java.util.LinkedHashMap<>(params);
    }

    private String stringValue(Map<String, Object> params, String primaryKey, String fallbackKey) {
        Object value = params.get(primaryKey);
        if (value == null) {
            value = params.get(fallbackKey);
        }
        return value != null ? value.toString() : null;
    }
}
