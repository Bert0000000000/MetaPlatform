package com.metaplatform.a2a.inbound;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.a2a.clients.AgentServiceClient;
import com.metaplatform.a2a.clients.WfeClient;
import com.metaplatform.a2a.common.TenantContext;
import com.metaplatform.a2a.entity.InboundTaskEntity;
import com.metaplatform.a2a.exception.A2aException;
import com.metaplatform.a2a.repository.InboundTaskRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 入站 JSON-RPC 任务服务。
 *
 * <p>对应 Python {@code app.inbound.service.InboundTaskService}。
 * 接收并处理外部 A2A Agent 发来的 JSON-RPC 2.0 任务请求：
 * <ul>
 *   <li>{@code tasks/send} — 创建任务并执行</li>
 *   <li>{@code tasks/get} — 查询任务状态</li>
 *   <li>{@code tasks/cancel} — 取消任务</li>
 * </ul></p>
 *
 * <p>任务执行根据 taskType 路由到不同上游：
 * <ul>
 *   <li>{@code agent.*} → {@link AgentServiceClient}</li>
 *   <li>{@code workflow.*} → {@link WfeClient}</li>
 *   <li>其他 → 直接返回 PENDING</li>
 * </ul></p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class InboundTaskService {

    public static final String STATUS_PENDING = "PENDING";
    public static final String STATUS_WORKING = "WORKING";
    public static final String STATUS_COMPLETED = "COMPLETED";
    public static final String STATUS_FAILED = "FAILED";
    public static final String STATUS_CANCELED = "CANCELED";

    private final InboundTaskRepository taskRepository;
    private final ObjectMapper objectMapper;
    private final AgentServiceClient agentServiceClient;
    private final WfeClient wfeClient;

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

    /**
     * JSON-RPC tasks/send：接收并处理任务。
     *
     * @param tenantId      租户 ID
     * @param sourceAgentId 源 Agent ID
     * @param targetAgentId 目标 Agent ID
     * @param jsonrpcId     JSON-RPC 请求 ID（用于响应匹配）
     * @param payload       任务负载（JSON 对象）
     * @return JSON-RPC 2.0 响应
     */
    @Transactional
    public Map<String, Object> handleSend(String tenantId, String sourceAgentId,
                                           String targetAgentId, String jsonrpcId,
                                           Map<String, Object> payload) {
        // 创建入站任务
        InboundTaskEntity entity = new InboundTaskEntity();
        entity.setId(UUID.randomUUID().toString().replace("-", ""));
        entity.setTenantId(tenantId);
        entity.setSourceAgentId(sourceAgentId);
        entity.setTargetAgentId(targetAgentId);
        entity.setTaskType(extractTaskType(payload));
        entity.setPayload(toJson(payload, "{}"));
        entity.setStatus(STATUS_WORKING);
        entity.setTraceId(TenantContext.getTraceId());
        entity.setJsonrpcId(jsonrpcId);

        InboundTaskEntity saved = taskRepository.save(entity);

        // 执行任务
        try {
            Map<String, Object> result = executeTask(saved);
            saved.setResult(toJson(result, "{}"));
            saved.setStatus(STATUS_COMPLETED);
            saved.setCompletedAt(OffsetDateTime.now());
            taskRepository.save(saved);

            return buildJsonRpcSuccess(jsonrpcId, Map.of(
                    "id", saved.getId(),
                    "status", STATUS_COMPLETED,
                    "result", result));
        } catch (Exception ex) {
            log.error("入站任务执行失败 | taskId={}", saved.getId(), ex);
            saved.setError(truncate(ex.getMessage(), 2048));
            saved.setStatus(STATUS_FAILED);
            saved.setCompletedAt(OffsetDateTime.now());
            taskRepository.save(saved);

            return buildJsonRpcError(jsonrpcId, -32603,
                    "Internal error: " + ex.getMessage());
        }
    }

    /**
     * JSON-RPC tasks/get：查询任务状态。
     */
    @Transactional(readOnly = true)
    public Map<String, Object> handleGet(String tenantId, String taskId, String jsonrpcId) {
        InboundTaskEntity entity = taskRepository.findByIdAndTenantId(taskId, tenantId)
                .orElseThrow(() -> A2aException.taskNotFound(taskId));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", entity.getId());
        result.put("status", entity.getStatus());
        if (entity.getResult() != null) {
            result.put("result", parseJson(entity.getResult()));
        }
        if (entity.getError() != null) {
            result.put("error", entity.getError());
        }
        result.put("createdAt", entity.getCreatedAt());
        result.put("completedAt", entity.getCompletedAt());

        return buildJsonRpcSuccess(jsonrpcId, result);
    }

    /**
     * JSON-RPC tasks/cancel：取消任务。
     */
    @Transactional
    public Map<String, Object> handleCancel(String tenantId, String taskId, String jsonrpcId) {
        InboundTaskEntity entity = taskRepository.findByIdAndTenantId(taskId, tenantId)
                .orElseThrow(() -> A2aException.taskNotFound(taskId));

        if (STATUS_COMPLETED.equals(entity.getStatus()) || STATUS_FAILED.equals(entity.getStatus())) {
            return buildJsonRpcError(jsonrpcId, -32600,
                    "Task already terminal: " + entity.getStatus());
        }

        entity.setStatus(STATUS_CANCELED);
        entity.setCompletedAt(OffsetDateTime.now());
        taskRepository.save(entity);

        return buildJsonRpcSuccess(jsonrpcId, Map.of(
                "id", taskId,
                "status", STATUS_CANCELED));
    }

    /**
     * 入站任务列表（分页）。
     */
    @Transactional(readOnly = true)
    public com.metaplatform.a2a.common.PageResponse<Map<String, Object>> list(
            String tenantId, String status, int page, int pageSize) {
        PageRequest pageRequest = PageRequest.of(page - 1, pageSize,
                Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<InboundTaskEntity> result = (status != null && !status.isBlank())
                ? taskRepository.findByTenantIdAndStatus(tenantId, status, pageRequest)
                : taskRepository.findByTenantIdAndTargetAgentId(
                        tenantId, "", pageRequest);
        List<Map<String, Object>> items = result.getContent().stream()
                .map(this::toResponse).toList();
        return com.metaplatform.a2a.common.PageResponse.of(
                items, result.getTotalElements(), page, pageSize);
    }

    // ----------------------------------------------------------- helpers

    @SuppressWarnings("unchecked")
    private Map<String, Object> executeTask(InboundTaskEntity task) {
        String taskType = task.getTaskType();
        Map<String, Object> payload = parseJson(task.getPayload());

        if (taskType == null || taskType.isBlank()) {
            // 默认直接返回 payload 作为结果
            return Map.of("output", payload);
        }

        if (taskType.startsWith("agent.")) {
            // 路由到 TECH-AGENT
            String agentCode = taskType.substring("agent.".length());
            String input = payload.getOrDefault("input", "").toString();
            return agentServiceClient.execute(agentCode, input);
        }

        if (taskType.startsWith("workflow.")) {
            // 路由到 TECH-WFE
            String workflowCode = taskType.substring("workflow.".length());
            return wfeClient.startWorkflow(workflowCode, payload);
        }

        // 默认：直接返回 payload
        return Map.of("output", payload);
    }

    @SuppressWarnings("unchecked")
    private String extractTaskType(Map<String, Object> payload) {
        if (payload == null) {
            return "generic";
        }
        Object type = payload.get("task_type");
        if (type == null) {
            type = payload.get("taskType");
        }
        return type != null ? type.toString() : "generic";
    }

    private String toJson(Object obj, String defaultValue) {
        if (obj == null) {
            return defaultValue;
        }
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException ex) {
            return defaultValue;
        }
    }

    private Map<String, Object> parseJson(String json) {
        if (json == null || json.isBlank()) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(json, MAP_TYPE);
        } catch (Exception e) {
            return Map.of();
        }
    }

    private String truncate(String s, int maxLen) {
        if (s == null) {
            return null;
        }
        return s.length() > maxLen ? s.substring(0, maxLen) : s;
    }

    private Map<String, Object> buildJsonRpcSuccess(String id, Object result) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("jsonrpc", "2.0");
        response.put("id", id);
        response.put("result", result);
        return response;
    }

    private Map<String, Object> buildJsonRpcError(String id, int code, String message) {
        Map<String, Object> error = new LinkedHashMap<>();
        error.put("code", code);
        error.put("message", message);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("jsonrpc", "2.0");
        response.put("id", id);
        response.put("error", error);
        return response;
    }

    private Map<String, Object> toResponse(InboundTaskEntity entity) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", entity.getId());
        result.put("tenantId", entity.getTenantId());
        result.put("sourceAgentId", entity.getSourceAgentId());
        result.put("targetAgentId", entity.getTargetAgentId());
        result.put("taskType", entity.getTaskType());
        result.put("payload", parseJson(entity.getPayload()));
        result.put("status", entity.getStatus());
        result.put("result", entity.getResult() != null ? parseJson(entity.getResult()) : null);
        result.put("error", entity.getError());
        result.put("traceId", entity.getTraceId());
        result.put("jsonrpcId", entity.getJsonrpcId());
        result.put("createdAt", entity.getCreatedAt());
        result.put("updatedAt", entity.getUpdatedAt());
        result.put("completedAt", entity.getCompletedAt());
        return result;
    }
}
