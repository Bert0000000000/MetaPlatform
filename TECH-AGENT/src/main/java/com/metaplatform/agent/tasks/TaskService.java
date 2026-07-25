package com.metaplatform.agent.tasks;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.agent.common.ErrorCode;
import com.metaplatform.agent.common.PageResponse;
import com.metaplatform.agent.entity.AgentTaskEntity;
import com.metaplatform.agent.exception.AgentException;
import com.metaplatform.agent.repository.AgentTaskRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Agent 任务服务：创建、查询、分配、状态更新、统计。
 *
 * <p>基于 JPA 仓储持久化，JSON 字段（input/output）通过 Jackson 序列化存储为 String。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TaskService {

    private static final Set<String> VALID_STATUSES = Set.of(
            "PENDING", "ASSIGNED", "RUNNING", "COMPLETED", "FAILED", "CANCELLED");
    private static final Set<String> TERMINAL_STATUSES = Set.of("COMPLETED", "CANCELLED");
    private static final Set<String> END_STATUSES = Set.of("COMPLETED", "FAILED", "CANCELLED");
    private static final Set<String> PENDING_STATUSES = Set.of("PENDING", "ASSIGNED");
    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

    private final AgentTaskRepository repository;
    private final ObjectMapper objectMapper;

    /**
     * 创建任务。
     */
    public TaskResponse create(String tenantId, CreateTaskRequest request) {
        String taskId = "task-" + UUID.randomUUID().toString().replace("-", "").substring(0, 24);
        String status = request.getAssignedTo() != null ? "ASSIGNED" : "PENDING";

        AgentTaskEntity entity = new AgentTaskEntity();
        entity.setId(taskId);
        entity.setTenantId(tenantId);
        entity.setAgentId(request.getAgentId());
        entity.setTitle(request.getTitle());
        entity.setDescription(request.getDescription());
        entity.setStatus(status);
        entity.setPriority(request.getPriority() != null ? request.getPriority() : "MEDIUM");
        entity.setAssignedTo(request.getAssignedTo());
        entity.setInput(toJson(request.getInput()));

        entity = repository.save(entity);
        return toResponse(entity);
    }

    /**
     * 查询任务详情。
     */
    public TaskResponse get(String tenantId, String taskId) {
        AgentTaskEntity entity = repository.findByIdAndTenantId(taskId, tenantId)
                .orElseThrow(() -> AgentException.taskNotFound(taskId));
        return toResponse(entity);
    }

    /**
     * 分页查询任务列表。
     */
    public PageResponse<TaskResponse> list(String tenantId, String agentId,
                                           String status, int page, int pageSize) {
        Sort sort = Sort.by(Sort.Direction.DESC, "createdAt");
        Pageable pageable = PageRequest.of(page - 1, pageSize, sort);

        boolean hasAgent = agentId != null && !agentId.isBlank();
        boolean hasStatus = status != null && !status.isBlank();

        if (hasStatus) {
            validateStatus(status);
        }

        Page<AgentTaskEntity> result;
        if (hasAgent && hasStatus) {
            // 仓储只有 List 返回的重载，手动分页
            List<AgentTaskEntity> all = repository
                    .findByTenantIdAndAgentIdAndStatus(tenantId, agentId, status);
            all.sort((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()));
            int total = all.size();
            int from = Math.min((page - 1) * pageSize, total);
            int to = Math.min(from + pageSize, total);
            result = new org.springframework.data.domain.PageImpl<>(
                    all.subList(from, to), pageable, total);
        } else if (hasAgent) {
            result = repository.findByTenantIdAndAgentId(tenantId, agentId, pageable);
        } else if (hasStatus) {
            result = repository.findByTenantIdAndStatus(tenantId, status, pageable);
        } else {
            // 无过滤条件：findAll + 租户过滤
            Page<AgentTaskEntity> raw = repository.findAll(pageable);
            List<AgentTaskEntity> filtered = raw.getContent().stream()
                    .filter(e -> tenantId.equals(e.getTenantId()))
                    .collect(Collectors.toList());
            result = new org.springframework.data.domain.PageImpl<>(filtered, pageable, filtered.size());
        }

        List<TaskResponse> items = result.getContent().stream()
                .map(this::toResponse)
                .toList();
        return PageResponse.of(items, result.getTotalElements(), page, pageSize);
    }

    /**
     * 分配任务给指定用户。
     */
    public TaskResponse assign(String tenantId, String taskId, String assignedTo) {
        AgentTaskEntity entity = repository.findByIdAndTenantId(taskId, tenantId)
                .orElseThrow(() -> AgentException.taskNotFound(taskId));

        if (TERMINAL_STATUSES.contains(entity.getStatus())) {
            throw new AgentException(ErrorCode.INVALID_PARAM,
                    "无法分配已结束的任务: status=" + entity.getStatus());
        }

        entity.setAssignedTo(assignedTo);
        entity.setStatus("ASSIGNED");
        entity = repository.save(entity);
        return toResponse(entity);
    }

    /**
     * 更新任务状态。
     */
    public TaskResponse updateStatus(String tenantId, String taskId, UpdateTaskStatusRequest request) {
        validateStatus(request.getStatus());

        AgentTaskEntity entity = repository.findByIdAndTenantId(taskId, tenantId)
                .orElseThrow(() -> AgentException.taskNotFound(taskId));

        OffsetDateTime now = OffsetDateTime.now();
        entity.setStatus(request.getStatus());

        if ("RUNNING".equals(request.getStatus()) && entity.getStartedAt() == null) {
            entity.setStartedAt(now);
        }
        if (END_STATUSES.contains(request.getStatus())) {
            entity.setCompletedAt(now);
        }
        if (request.getOutput() != null) {
            entity.setOutput(toJson(request.getOutput()));
        }
        if (request.getErrorMessage() != null) {
            entity.setErrorMessage(request.getErrorMessage());
        }

        entity = repository.save(entity);
        return toResponse(entity);
    }

    /**
     * 获取任务输出结果。
     */
    public Map<String, Object> getTaskResult(String tenantId, String taskId) {
        AgentTaskEntity entity = repository.findByIdAndTenantId(taskId, tenantId)
                .orElseThrow(() -> AgentException.taskNotFound(taskId));
        return fromJson(entity.getOutput());
    }

    /**
     * 获取指定 Agent 的任务统计。
     */
    public TaskStatistics getStatistics(String tenantId, String agentId) {
        Pageable largePage = PageRequest.of(0, 10000);
        Page<AgentTaskEntity> page = repository.findByTenantIdAndAgentId(tenantId, agentId, largePage);
        List<AgentTaskEntity> tasks = page.getContent();

        int total = tasks.size();
        int completed = (int) tasks.stream().filter(t -> "COMPLETED".equals(t.getStatus())).count();
        int failed = (int) tasks.stream().filter(t -> "FAILED".equals(t.getStatus())).count();
        int running = (int) tasks.stream().filter(t -> "RUNNING".equals(t.getStatus())).count();
        int pending = (int) tasks.stream().filter(t -> PENDING_STATUSES.contains(t.getStatus())).count();

        double avgDuration = tasks.stream()
                .filter(t -> "COMPLETED".equals(t.getStatus())
                        && t.getStartedAt() != null && t.getCompletedAt() != null)
                .mapToLong(t -> Duration.between(t.getStartedAt(), t.getCompletedAt()).toMillis())
                .average()
                .orElse(0.0);

        return TaskStatistics.builder()
                .total(total)
                .completed(completed)
                .failed(failed)
                .running(running)
                .pending(pending)
                .avgDurationMs(Math.round(avgDuration * 100.0) / 100.0)
                .build();
    }

    // ----------------------------------------------------------- helpers

    private void validateStatus(String status) {
        if (!VALID_STATUSES.contains(status)) {
            throw AgentException.invalidParam("不支持的任务状态: " + status);
        }
    }

    private TaskResponse toResponse(AgentTaskEntity entity) {
        return TaskResponse.builder()
                .taskId(entity.getId())
                .tenantId(entity.getTenantId())
                .agentId(entity.getAgentId())
                .title(entity.getTitle())
                .description(entity.getDescription())
                .status(entity.getStatus())
                .priority(entity.getPriority())
                .assignedTo(entity.getAssignedTo())
                .input(fromJson(entity.getInput()))
                .output(fromJson(entity.getOutput()))
                .errorMessage(entity.getErrorMessage())
                .createdAt(entity.getCreatedAt())
                .startedAt(entity.getStartedAt())
                .completedAt(entity.getCompletedAt())
                .build();
    }

    private String toJson(Map<String, Object> data) {
        if (data == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(data);
        } catch (JsonProcessingException e) {
            log.warn("序列化 JSON 失败", e);
            return null;
        }
    }

    private Map<String, Object> fromJson(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(json, MAP_TYPE);
        } catch (JsonProcessingException e) {
            log.warn("反序列化 JSON 失败: {}", json, e);
            return null;
        }
    }
}
