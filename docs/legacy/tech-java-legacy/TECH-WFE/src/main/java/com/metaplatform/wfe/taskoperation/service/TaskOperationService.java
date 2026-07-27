package com.metaplatform.wfe.taskoperation.service;

import com.metaplatform.wfe.common.ErrorCode;
import com.metaplatform.wfe.common.TenantContext;
import com.metaplatform.wfe.common.TraceContext;
import com.metaplatform.wfe.entity.WfeTaskCommentEntity;
import com.metaplatform.wfe.entity.WfeTaskEntity;
import com.metaplatform.wfe.exception.WfeException;
import com.metaplatform.wfe.repository.WfeTaskCommentRepository;
import com.metaplatform.wfe.repository.WfeTaskRepository;
import com.metaplatform.wfe.service.WfeOutboxService;
import com.metaplatform.wfe.taskoperation.dto.AddSignRequest;
import com.metaplatform.wfe.taskoperation.dto.DelegateRequest;
import com.metaplatform.wfe.taskoperation.dto.TaskOperationResponse;
import com.metaplatform.wfe.taskoperation.dto.UrgeRequest;
import com.metaplatform.wfe.taskoperation.entity.TaskAddSignEntity;
import com.metaplatform.wfe.taskoperation.entity.TaskDelegationEntity;
import com.metaplatform.wfe.taskoperation.entity.TaskUrgeEntity;
import com.metaplatform.wfe.taskoperation.repository.TaskAddSignRepository;
import com.metaplatform.wfe.taskoperation.repository.TaskDelegationRepository;
import com.metaplatform.wfe.taskoperation.repository.TaskUrgeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class TaskOperationService {

    private static final String STATUS_PENDING = "PENDING";
    private static final String STATUS_ACTIVE = "ACTIVE";

    private final WfeTaskRepository wfeTaskRepository;
    private final WfeTaskCommentRepository wfeTaskCommentRepository;
    private final TaskDelegationRepository delegationRepository;
    private final TaskAddSignRepository addSignRepository;
    private final TaskUrgeRepository urgeRepository;
    private final WfeOutboxService wfeOutboxService;

    @Transactional
    public TaskOperationResponse addSign(String taskId, AddSignRequest request) {
        WfeTaskEntity task = findActiveTask(taskId);
        String tenantId = TenantContext.get();
        String fromUser = task.getAssignee() != null ? task.getAssignee() : TenantContext.getUserId();
        Instant now = Instant.now();
        TaskAddSignEntity entity = TaskAddSignEntity.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(tenantId)
                .taskId(taskId)
                .addsignUser(request.getAddsignUser())
                .reason(request.getReason())
                .status(STATUS_PENDING)
                .createdAt(now)
                .updatedAt(now)
                .build();
        TaskAddSignEntity saved = addSignRepository.save(entity);
        // 当前 assignee 同步包含加签人，便于后续推进
        try {
            String currentAssignee = task.getAssignee();
            String nextAssignee = currentAssignee == null || currentAssignee.isBlank()
                    ? request.getAddsignUser()
                    : currentAssignee + "," + request.getAddsignUser();
            task.setAssignee(nextAssignee);
            wfeTaskRepository.save(task);
            saveComment(tenantId, taskId, task.getProcessInstanceId(), fromUser,
                    "ADDSIGN by " + fromUser + " -> " + request.getAddsignUser()
                            + (request.getReason() != null ? " | " + request.getReason() : ""));
        } catch (Exception e) {
            log.warn("addSign partial failure (history persisted): taskId={}, error={}", taskId, e.getMessage());
        }
        publishOutboxEvent(tenantId, taskId, "TASK_ADDSIGN", fromUser, request.getAddsignUser(), request.getReason());
        return toResponse(saved, "ADDSIGN", fromUser);
    }

    @Transactional
    public TaskOperationResponse delegate(String taskId, DelegateRequest request) {
        WfeTaskEntity task = findActiveTask(taskId);
        String tenantId = TenantContext.get();
        String fromUser = task.getAssignee() != null ? task.getAssignee() : TenantContext.getUserId();
        Instant now = Instant.now();
        TaskDelegationEntity entity = TaskDelegationEntity.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(tenantId)
                .taskId(taskId)
                .fromUser(fromUser)
                .toUser(request.getToUser())
                .reason(request.getReason())
                .createdAt(now)
                .build();
        TaskDelegationEntity saved = delegationRepository.save(entity);
        try {
            task.setAssignee(request.getToUser());
            wfeTaskRepository.save(task);
            saveComment(tenantId, taskId, task.getProcessInstanceId(), fromUser,
                    "DELEGATE from " + fromUser + " -> " + request.getToUser()
                            + (request.getReason() != null ? " | " + request.getReason() : ""));
        } catch (Exception e) {
            log.warn("delegate partial failure (history persisted): taskId={}, error={}", taskId, e.getMessage());
        }
        publishOutboxEvent(tenantId, taskId, "TASK_DELEGATED", fromUser, request.getToUser(), request.getReason());
        return toResponse(saved, "DELEGATE", fromUser);
    }

    @Transactional
    public TaskOperationResponse urge(String taskId, UrgeRequest request) {
        WfeTaskEntity task = findActiveTask(taskId);
        String tenantId = TenantContext.get();
        String operator = TenantContext.getUserId() != null ? TenantContext.getUserId() : "system";
        Instant now = Instant.now();
        TaskUrgeEntity entity = TaskUrgeEntity.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(tenantId)
                .taskId(taskId)
                .urgedUser(request.getUrgedUser())
                .message(request.getMessage())
                .createdAt(now)
                .build();
        TaskUrgeEntity saved = urgeRepository.save(entity);
        try {
            saveComment(tenantId, taskId, task.getProcessInstanceId(), operator,
                    "URGE by " + operator + " -> " + request.getUrgedUser()
                            + (request.getMessage() != null ? " | " + request.getMessage() : ""));
        } catch (Exception e) {
            log.warn("urge partial failure (history persisted): taskId={}, error={}", taskId, e.getMessage());
        }
        publishOutboxEvent(tenantId, taskId, "TASK_URGED", operator, request.getUrgedUser(), request.getMessage());
        return toResponse(saved, "URGE", operator);
    }

    private WfeTaskEntity findActiveTask(String taskId) {
        return wfeTaskRepository.findByIdAndStatus(taskId, STATUS_ACTIVE)
                .orElseThrow(() -> new WfeException(ErrorCode.TASK_NOT_FOUND, "任务不存在或已完成: " + taskId));
    }

    private void saveComment(String tenantId, String taskId, String processInstanceId,
                             String userId, String content) {
        try {
            WfeTaskCommentEntity comment = WfeTaskCommentEntity.builder()
                    .id(UUID.randomUUID().toString())
                    .tenantId(tenantId)
                    .taskId(taskId)
                    .processInstanceId(processInstanceId)
                    .userId(userId)
                    .content(content)
                    .build();
            wfeTaskCommentRepository.save(comment);
        } catch (Exception e) {
            log.warn("Failed to save task comment (non-blocking): taskId={}, error={}",
                    taskId, e.getMessage());
        }
    }

    private TaskOperationResponse toResponse(TaskDelegationEntity e, String type, String operator) {
        return TaskOperationResponse.builder()
                .id(e.getId())
                .taskId(e.getTaskId())
                .type(type)
                .operator(operator)
                .targetUser(e.getToUser())
                .reason(e.getReason())
                .createdAt(e.getCreatedAt())
                .build();
    }

    private TaskOperationResponse toResponse(TaskAddSignEntity e, String type, String operator) {
        return TaskOperationResponse.builder()
                .id(e.getId())
                .taskId(e.getTaskId())
                .type(type)
                .operator(operator)
                .targetUser(e.getAddsignUser())
                .reason(e.getReason())
                .createdAt(e.getCreatedAt())
                .build();
    }

    private TaskOperationResponse toResponse(TaskUrgeEntity e, String type, String operator) {
        return TaskOperationResponse.builder()
                .id(e.getId())
                .taskId(e.getTaskId())
                .type(type)
                .operator(operator)
                .targetUser(e.getUrgedUser())
                .reason(e.getMessage())
                .createdAt(e.getCreatedAt())
                .build();
    }

    private void publishOutboxEvent(String tenantId, String taskId, String eventType,
                                    String operator, String target, String description) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("taskId", taskId);
            payload.put("eventType", eventType);
            payload.put("operator", operator);
            payload.put("target", target);
            payload.put("description", description);
            Map<String, String> headers = new HashMap<>();
            headers.put(TraceContext.TRACE_ID_HEADER, TraceContext.getOrCreate());
            wfeOutboxService.publishEvent(tenantId, taskId, eventType, payload, headers);
        } catch (Exception e) {
            log.warn("Failed to publish {} event (non-blocking): taskId={}, error={}",
                    eventType, taskId, e.getMessage());
        }
    }
}
