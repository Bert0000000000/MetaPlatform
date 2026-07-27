package com.metaplatform.a2a.delegation;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.a2a.audit.AuditService;
import com.metaplatform.a2a.clients.AgentClient;
import com.metaplatform.a2a.common.PageResponse;
import com.metaplatform.a2a.common.TenantContext;
import com.metaplatform.a2a.entity.DelegatedTaskEntity;
import com.metaplatform.a2a.events.EventType;
import com.metaplatform.a2a.events.OutboxService;
import com.metaplatform.a2a.exception.A2aException;
import com.metaplatform.a2a.repository.DelegatedTaskRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 委派任务服务。
 *
 * <p>对应 Python {@code app.delegation.service.DelegationService}。
 * 管理 Agent 间任务委派的生命周期，包括委派 / 查询 / 取消 / 状态更新。
 * 通过 {@link AgentClient} 调用外部 A2A Agent 执行任务。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DelegationService {

    private final DelegatedTaskRepository taskRepository;
    private final ObjectMapper objectMapper;
    private final AuditService auditService;
    private final OutboxService outboxService;
    private final AgentClient agentClient;

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};
    private static final TypeReference<List<Map<String, Object>>> LIST_TYPE = new TypeReference<>() {};

    /**
     * 委派任务到目标 Agent。
     *
     * <p>流程：创建 PENDING 任务 → 调用 AgentClient.sendTask → 更新为 SUBMITTED/WORKING。</p>
     */
    @Transactional
    public Map<String, Object> delegate(String tenantId, DelegateTaskRequest request) {
        // 创建任务记录
        DelegatedTaskEntity entity = new DelegatedTaskEntity();
        entity.setId(UUID.randomUUID().toString().replace("-", ""));
        entity.setTenantId(tenantId);
        entity.setSourceAgentId(request.getSourceAgentId());
        entity.setTargetAgentId(request.getTargetAgentId());
        entity.setTaskType(request.getTaskType() != null ? request.getTaskType() : "generic");
        entity.setPayload(toJson(request.getPayload(), "{}"));
        entity.setStatus(TaskStatus.PENDING.getCode());
        entity.setTraceId(TenantContext.getTraceId());
        entity.setTimeout(request.getTimeout());
        entity.setCallbackUrl(request.getCallbackUrl());
        entity.setStatusHistory(toJson(List.of(statusEntry(
                TaskStatus.PENDING.getCode(), "任务已创建")), "[]"));
        entity.setArtifacts("[]");

        DelegatedTaskEntity saved = taskRepository.save(entity);

        // 调用外部 A2A Agent
        try {
            Map<String, Object> sendPayload = new LinkedHashMap<>();
            sendPayload.put("task_id", saved.getId());
            sendPayload.put("source_agent", request.getSourceAgentId());
            sendPayload.put("message", Map.of(
                    "role", "user",
                    "content", request.getPayload() != null ? request.getPayload() : Map.of()));

            Map<String, Object> response = agentClient.sendTask(
                    request.getTargetAgentId(), sendPayload);

            // 更新状态为 SUBMITTED / WORKING
            String respStatus = extractStatus(response);
            TaskStatus newStatus = "COMPLETED".equalsIgnoreCase(respStatus)
                    ? TaskStatus.COMPLETED : TaskStatus.WORKING;
            updateStatus(saved, newStatus, "外部 Agent 已接收任务");

            // 保存结果
            if (response.get("artifacts") != null) {
                saved.setArtifacts(toJson(response.get("artifacts"), "[]"));
            }
            if (response.get("result") != null) {
                saved.setResult(toJson(response.get("result"), "{}"));
            }
            if (newStatus == TaskStatus.COMPLETED) {
                saved.setCompletedAt(OffsetDateTime.now());
            }
            taskRepository.save(saved);

            auditService.record(AuditService.ACTION_TASK_DELEGATED,
                    request.getSourceAgentId(), saved.getId(),
                    Map.of("target", request.getTargetAgentId(),
                            "status", newStatus.getCode()));
            outboxService.recordEvent(EventType.TASK_STATUS_CHANGED, toEventPayload(saved));

        } catch (A2aException ex) {
            // 上游调用失败：标记为 FAILED
            updateStatus(saved, TaskStatus.FAILED, ex.getMessage());
            saved.setError(truncate(ex.getMessage(), 2048));
            taskRepository.save(saved);

            auditService.record(AuditService.ACTION_TASK_UPDATED,
                    request.getSourceAgentId(), saved.getId(),
                    Map.of("status", "FAILED", "error", ex.getMessage()));
            outboxService.recordEvent(EventType.TASK_STATUS_CHANGED, toEventPayload(saved));

            // 不抛出异常，返回任务状态（客户端可查询重试）
            log.warn("委派任务上游调用失败，标记为 FAILED | taskId={}", saved.getId());
        }

        return toResponse(saved);
    }

    /**
     * 查询任务详情。
     */
    @Transactional(readOnly = true)
    public Map<String, Object> get(String tenantId, String taskId) {
        DelegatedTaskEntity entity = taskRepository.findByIdAndTenantId(taskId, tenantId)
                .orElseThrow(() -> A2aException.taskNotFound(taskId));
        return toResponse(entity);
    }

    /**
     * 任务列表（分页 + 源/目标 Agent 过滤 + 状态过滤）。
     */
    @Transactional(readOnly = true)
    public PageResponse<Map<String, Object>> list(
            String tenantId, String sourceAgentId, String targetAgentId,
            String status, int page, int pageSize) {
        PageRequest pageRequest = PageRequest.of(page - 1, pageSize,
                Sort.by(Sort.Direction.DESC, "createdAt"));

        Page<DelegatedTaskEntity> result;
        if (status != null && !status.isBlank()) {
            result = taskRepository.findByTenantIdAndStatus(tenantId, status, pageRequest);
        } else if (sourceAgentId != null && !sourceAgentId.isBlank()) {
            result = taskRepository.findByTenantIdAndSourceAgentId(
                    tenantId, sourceAgentId, pageRequest);
        } else if (targetAgentId != null && !targetAgentId.isBlank()) {
            result = taskRepository.findByTenantIdAndTargetAgentId(
                    tenantId, targetAgentId, pageRequest);
        } else {
            result = taskRepository.findAll(pageRequest);
            // 过滤租户
            List<Map<String, Object>> items = result.getContent().stream()
                    .filter(e -> tenantId.equals(e.getTenantId()))
                    .map(this::toResponse).toList();
            return PageResponse.of(items, items.size(), page, pageSize);
        }

        List<Map<String, Object>> items = result.getContent().stream()
                .map(this::toResponse).toList();
        return PageResponse.of(items, result.getTotalElements(), page, pageSize);
    }

    /**
     * 取消任务。
     */
    @Transactional
    public Map<String, Object> cancel(String tenantId, String taskId, String actorId) {
        DelegatedTaskEntity entity = taskRepository.findByIdAndTenantId(taskId, tenantId)
                .orElseThrow(() -> A2aException.taskNotFound(taskId));

        TaskStatus current = TaskStatus.fromCode(entity.getStatus());
        if (current.isTerminal()) {
            throw A2aException.taskAlreadyCompleted(taskId, entity.getStatus());
        }

        // 调用外部 Agent 取消
        try {
            agentClient.cancelTask(entity.getTargetAgentId(), taskId);
        } catch (A2aException ex) {
            log.warn("取消任务上游调用失败，继续本地标记 | taskId={}", taskId);
        }

        updateStatus(entity, TaskStatus.CANCELED, "用户主动取消");
        entity.setCompletedAt(OffsetDateTime.now());
        taskRepository.save(entity);

        auditService.record(AuditService.ACTION_TASK_CANCELED, actorId, taskId, Map.of());
        outboxService.recordEvent(EventType.TASK_STATUS_CHANGED, toEventPayload(entity));

        return toResponse(entity);
    }

    /**
     * 更新任务状态（用于回调 / 内部状态变更）。
     */
    @Transactional
    public Map<String, Object> updateTaskStatus(String tenantId, String taskId,
                                                 String newStatus, Map<String, Object> result,
                                                 String error, String actorId) {
        DelegatedTaskEntity entity = taskRepository.findByIdAndTenantId(taskId, tenantId)
                .orElseThrow(() -> A2aException.taskNotFound(taskId));

        TaskStatus target = TaskStatus.fromCode(newStatus);
        TaskStatus current = TaskStatus.fromCode(entity.getStatus());
        if (!current.canTransitionTo(target)) {
            throw A2aException.invalidParam(
                    "不允许的状态转换: " + current.getCode() + " → " + target.getCode());
        }

        updateStatus(entity, target, "状态更新: " + target.getCode());
        if (result != null) {
            entity.setResult(toJson(result, "{}"));
        }
        if (error != null) {
            entity.setError(truncate(error, 2048));
        }
        if (target.isTerminal()) {
            entity.setCompletedAt(OffsetDateTime.now());
        }

        taskRepository.save(entity);

        auditService.record(AuditService.ACTION_TASK_UPDATED, actorId, taskId,
                Map.of("status", target.getCode()));
        outboxService.recordEvent(EventType.TASK_STATUS_CHANGED, toEventPayload(entity));

        return toResponse(entity);
    }

    /**
     * 拉取待执行任务（按 targetAgentId + PENDING/SUBMITTED）。
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> pendingTasks(String tenantId, String targetAgentId) {
        List<DelegatedTaskEntity> tasks = taskRepository
                .findByTenantIdAndTargetAgentIdAndStatus(
                        tenantId, targetAgentId, TaskStatus.PENDING.getCode());
        tasks.addAll(taskRepository.findByTenantIdAndTargetAgentIdAndStatus(
                tenantId, targetAgentId, TaskStatus.SUBMITTED.getCode()));
        return tasks.stream().map(this::toResponse).toList();
    }

    // ----------------------------------------------------------- helpers

    private void updateStatus(DelegatedTaskEntity entity, TaskStatus newStatus, String reason) {
        entity.setStatus(newStatus.getCode());

        List<Map<String, Object>> history = parseList(entity.getStatusHistory());
        history.add(statusEntry(newStatus.getCode(), reason));
        entity.setStatusHistory(toJson(history, "[]"));
    }

    private Map<String, Object> statusEntry(String status, String reason) {
        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("status", status);
        entry.put("reason", reason != null ? reason : "");
        entry.put("timestamp", OffsetDateTime.now().toString());
        return entry;
    }

    @SuppressWarnings("unchecked")
    private String extractStatus(Map<String, Object> response) {
        Object state = response.get("state");
        if (state instanceof Map<?, ?> stateMap) {
            Object status = stateMap.get("status");
            return status != null ? status.toString() : "WORKING";
        }
        Object status = response.get("status");
        return status != null ? status.toString() : "WORKING";
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

    private List<Map<String, Object>> parseList(String json) {
        if (json == null || json.isBlank()) {
            return new ArrayList<>();
        }
        try {
            return objectMapper.readValue(json, LIST_TYPE);
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    private String truncate(String s, int maxLen) {
        if (s == null) {
            return null;
        }
        return s.length() > maxLen ? s.substring(0, maxLen) : s;
    }

    private Map<String, Object> toResponse(DelegatedTaskEntity entity) {
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
        result.put("timeout", entity.getTimeout());
        result.put("callbackUrl", entity.getCallbackUrl());
        result.put("statusHistory", parseList(entity.getStatusHistory()));
        result.put("artifacts", parseList(entity.getArtifacts()));
        result.put("createdAt", entity.getCreatedAt());
        result.put("updatedAt", entity.getUpdatedAt());
        result.put("completedAt", entity.getCompletedAt());
        return result;
    }

    private Map<String, Object> toEventPayload(DelegatedTaskEntity entity) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("taskId", entity.getId());
        payload.put("tenantId", entity.getTenantId());
        payload.put("sourceAgentId", entity.getSourceAgentId());
        payload.put("targetAgentId", entity.getTargetAgentId());
        payload.put("status", entity.getStatus());
        payload.put("traceId", entity.getTraceId());
        return payload;
    }
}
