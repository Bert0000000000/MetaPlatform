package com.metaplatform.wfe.service;

import com.metaplatform.wfe.common.ErrorCode;
import com.metaplatform.wfe.common.PageResponse;
import com.metaplatform.wfe.common.TenantContext;
import com.metaplatform.wfe.common.TraceContext;
import com.metaplatform.wfe.dto.TaskActionRequest;
import com.metaplatform.wfe.dto.TaskActionResponse;
import com.metaplatform.wfe.dto.TaskResponse;
import com.metaplatform.wfe.engine.WfeStateMachineEngine;
import com.metaplatform.wfe.entity.WfeTaskCommentEntity;
import com.metaplatform.wfe.entity.WfeTaskEntity;
import com.metaplatform.wfe.entity.WfeTaskHistoryEntity;
import com.metaplatform.wfe.exception.WfeException;
import com.metaplatform.wfe.repository.WfeTaskCommentRepository;
import com.metaplatform.wfe.repository.WfeTaskHistoryRepository;
import com.metaplatform.wfe.repository.WfeTaskRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class WfeTaskService {

    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final String STATUS_COMPLETED = "COMPLETED";

    private final WfeTaskRepository wfeTaskRepository;
    private final WfeTaskHistoryRepository wfeTaskHistoryRepository;
    private final WfeTaskCommentRepository wfeTaskCommentRepository;
    private final WfeStateMachineEngine wfeStateMachineEngine;
    private final IamIntegrationService iamIntegrationService;
    private final WfeOutboxService wfeOutboxService;

    // ════════════════════════════════════════════
    // P1-WFE-04: 任务查询
    // ════════════════════════════════════════════

    public PageResponse<TaskResponse> getTodoTasks(String userId, int page, int size) {
        String tenantId = TenantContext.get();
        int safePage = Math.max(0, page - 1);
        int safeSize = Math.max(1, size);
        PageRequest pageRequest = PageRequest.of(safePage, safeSize,
                Sort.by(Sort.Direction.DESC, "createdAt"));

        Page<WfeTaskEntity> result = wfeTaskRepository
                .findByTenantIdAndAssigneeAndStatus(tenantId, userId, STATUS_ACTIVE, pageRequest);

        List<TaskResponse> items = result.getContent().stream().map(this::toResponse).toList();

        return PageResponse.<TaskResponse>builder()
                .items(items)
                .total(result.getTotalElements())
                .page(page)
                .pageSize(size)
                .totalPages(result.getTotalPages())
                .build();
    }

    public PageResponse<TaskResponse> getDoneTasks(String userId, int page, int size) {
        String tenantId = TenantContext.get();
        int safePage = Math.max(0, page - 1);
        int safeSize = Math.max(1, size);
        PageRequest pageRequest = PageRequest.of(safePage, safeSize,
                Sort.by(Sort.Direction.DESC, "createdAt"));

        // 已办任务：当前用户作为 assignee 操作过的审批记录
        Page<WfeTaskHistoryEntity> result = wfeTaskHistoryRepository
                .findByTenantIdAndAssigneeAndActionIn(
                        tenantId, userId,
                        List.of("APPROVE", "REJECT", "TRANSFER", "RETURN"),
                        pageRequest);

        List<TaskResponse> items = result.getContent().stream().map(this::toResponse).toList();

        return PageResponse.<TaskResponse>builder()
                .items(items)
                .total(result.getTotalElements())
                .page(page)
                .pageSize(size)
                .totalPages(result.getTotalPages())
                .build();
    }

    public TaskResponse getTaskById(String taskId) {
        // 优先从活动/已完成任务表查询
        return wfeTaskRepository.findById(taskId)
                .map(this::toResponse)
                .orElseGet(() -> {
                    // 不存在则从历史表查最新一条
                    String tenantId = TenantContext.get();
                    List<WfeTaskHistoryEntity> histories = wfeTaskHistoryRepository
                            .findByTenantIdAndTaskIdOrderByCreatedAtDesc(tenantId, taskId);
                    if (histories.isEmpty()) {
                        throw new WfeException(ErrorCode.TASK_NOT_FOUND);
                    }
                    return toResponse(histories.get(0));
                });
    }

    public List<TaskResponse> getTasksByProcessInstance(String processInstanceId) {
        String tenantId = TenantContext.get();
        List<WfeTaskEntity> tasks = wfeTaskRepository
                .findByTenantIdAndProcessInstanceIdOrderByCreatedAtDesc(tenantId, processInstanceId);
        return tasks.stream().map(this::toResponse).toList();
    }

    // ════════════════════════════════════════════
    // P1-WFE-05: 审批操作
    // P1-WFE-06: TECH-IAM 集成权限校验
    // P1-WFE-09: 操作成功后发布任务事件
    // ════════════════════════════════════════════

    public TaskActionResponse executeAction(String taskId, TaskActionRequest request) {
        String action = request.getAction();
        if (!isValidAction(action)) {
            throw new WfeException(ErrorCode.INVALID_PARAM, "无效的审批操作类型: " + action);
        }

        if ("TRANSFER".equals(action) && (request.getTransferTo() == null || request.getTransferTo().isBlank())) {
            throw new WfeException(ErrorCode.INVALID_PARAM, "转交操作必须指定 transferTo");
        }

        // 从自研任务表查询 ACTIVE 任务
        WfeTaskEntity task = wfeTaskRepository.findByIdAndStatus(taskId, STATUS_ACTIVE)
                .orElseThrow(() -> new WfeException(ErrorCode.TASK_NOT_FOUND));

        String tenantId = TenantContext.get();
        String userId = TenantContext.getUserId();
        String processInstanceId = task.getProcessInstanceId();
        String comment = request.getComment() != null ? request.getComment() : "";

        // P1-WFE-06: APPROVE 操作前校验审批权限
        if ("APPROVE".equals(action)) {
            boolean allowed = iamIntegrationService.checkPermission(
                    tenantId, userId, "task:" + taskId, "approve");
            if (!allowed) {
                throw new WfeException(ErrorCode.PERMISSION_DENIED, "无审批权限");
            }
        }

        try {
            switch (action) {
                case "APPROVE" -> doApprove(taskId, userId, comment);
                case "REJECT" -> doReject(taskId, userId, comment);
                case "TRANSFER" -> doTransfer(task, userId, comment, request.getTransferTo());
                case "RETURN" -> doReturn(taskId, userId, comment);
            }
        } catch (WfeException e) {
            throw e;
        } catch (Exception e) {
            log.error("Task action failed: taskId={}, action={}, error={}", taskId, action, e.getMessage());
            throw new WfeException(ErrorCode.PROCESS_EXECUTION_FAILED,
                    "审批操作执行失败: " + e.getMessage());
        }

        // P1-WFE-09: 操作成功后发布任务事件（失败不阻断审批结果）
        publishTaskEvent(tenantId, taskId, action, processInstanceId, comment, request.getTransferTo());

        return TaskActionResponse.builder()
                .taskId(taskId)
                .action(action)
                .status("SUCCESS")
                .message("审批操作执行成功")
                .build();
    }

    private void publishTaskEvent(String tenantId, String taskId, String action,
                                  String processInstanceId, String comment, String transferTo) {
        try {
            String eventType = switch (action) {
                case "APPROVE" -> "TASK_COMPLETED";
                case "REJECT" -> "TASK_REJECTED";
                case "TRANSFER" -> "TASK_TRANSFERRED";
                default -> null;
            };
            if (eventType == null) {
                return;
            }
            Map<String, Object> payload = new java.util.HashMap<>();
            payload.put("taskId", taskId);
            payload.put("processInstanceId", processInstanceId);
            payload.put("action", action);
            payload.put("comment", comment);
            if (transferTo != null) {
                payload.put("transferTo", transferTo);
            }
            Map<String, String> headers = new java.util.HashMap<>();
            headers.put(TraceContext.TRACE_ID_HEADER, TraceContext.getOrCreate());
            wfeOutboxService.publishEvent(tenantId, taskId, eventType, payload, headers);
        } catch (Exception e) {
            log.warn("Failed to publish task event (non-blocking): taskId={}, action={}, error={}",
                    taskId, action, e.getMessage());
        }
    }

    private void doApprove(String taskId, String userId, String comment) {
        // 状态机引擎内部会保存评论与历史，并推进流程
        wfeStateMachineEngine.completeTask(taskId, "APPROVE", userId, comment, null);
        log.info("Task approved: taskId={}, operator={}", taskId, userId);
    }

    private void doReject(String taskId, String userId, String comment) {
        // 状态机引擎内部会保存评论、终止流程实例
        wfeStateMachineEngine.completeTask(taskId, "REJECT", userId, comment, null);
        log.info("Task rejected: taskId={}, operator={}", taskId, userId);
    }

    private void doTransfer(WfeTaskEntity task, String userId, String comment, String transferTo) {
        // 转交不推进流程，只更新 assignee 与保存评论
        task.setAssignee(transferTo);
        wfeTaskRepository.save(task);
        saveComment(task.getTenantId(), task.getId(), task.getProcessInstanceId(), userId,
                "TRANSFER -> " + transferTo + (comment.isBlank() ? "" : " | " + comment));
        log.info("Task transferred: taskId={}, from={}, to={}", task.getId(), userId, transferTo);
    }

    private void doReturn(String taskId, String userId, String comment) {
        // 状态机引擎内部会保存评论与历史，通过 formData 携带 RETURN 标记推进流程
        wfeStateMachineEngine.completeTask(taskId, "RETURN", userId, comment, Map.of("action", "RETURN"));
        log.info("Task returned: taskId={}, operator={}", taskId, userId);
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

    private boolean isValidAction(String action) {
        return "APPROVE".equals(action) || "REJECT".equals(action)
                || "TRANSFER".equals(action) || "RETURN".equals(action);
    }

    // ════════════════════════════════════════════
    // DTO 转换
    // ════════════════════════════════════════════

    /**
     * P5.3 Direct approval task creation from external Action Proposal.
     * No BPMN template required; default assignee = requester manager.
     */
    @org.springframework.transaction.annotation.Transactional
    public java.util.Map<String, Object> createDirectApprovalTask(
            String tenantId, String requester, String summary,
            String externalActionProposalId, String actionCode, String riskLevel) {
        String taskId = UUID.randomUUID().toString();
        String processInstanceId = "PROC-" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        java.time.Instant now = java.time.Instant.now();
        WfeTaskEntity task = WfeTaskEntity.builder()
                .id(taskId)
                .tenantId(tenantId == null ? "tenant-default" : tenantId)
                .processInstanceId(processInstanceId)
                .processDefinitionId("agent-action-approval")
                .nodeId("manager-approval")
                .nodeName(summary == null ? "Action approval: " + actionCode : summary)
                .name(summary == null ? "Action approval: " + actionCode : summary)
                .assignee("manager@" + (tenantId == null ? "tenant-default" : tenantId))
                .status(STATUS_ACTIVE)
                .action("PENDING")
                .formData(java.util.Map.of(
                        "externalActionProposalId", externalActionProposalId == null ? "" : externalActionProposalId,
                        "actionCode", actionCode == null ? "" : actionCode,
                        "riskLevel", riskLevel == null ? "HIGH" : riskLevel,
                        "requester", requester == null ? "system" : requester
                ))
                .createdAt(now)
                .updatedAt(now)
                .build();
        wfeTaskRepository.save(task);
        log.info("[WfeTaskService] created direct approval task={} for proposal={} action={}",
                taskId, externalActionProposalId, actionCode);
        java.util.Map<String, Object> result = new java.util.HashMap<>();
        result.put("taskId", taskId);
        result.put("processInstanceId", processInstanceId);
        result.put("assignee", task.getAssignee());
        result.put("status", task.getStatus());
        return result;
    }

    private TaskResponse toResponse(WfeTaskEntity task) {
        String status = task.getStatus();
        // 完成时间：ACTIVE 为 null；COMPLETED/REJECTED/TERMINATED 取 completedAt
        java.time.Instant endTime = STATUS_ACTIVE.equals(status) ? null : task.getCompletedAt();
        return TaskResponse.builder()
                .id(task.getId())
                .name(task.getName())
                .assignee(task.getAssignee())
                .processInstanceId(task.getProcessInstanceId())
                .processDefinitionId(task.getProcessDefinitionId())
                .createTime(task.getCreatedAt())
                .endTime(endTime)
                .status(status)
                .build();
    }

    private TaskResponse toResponse(WfeTaskHistoryEntity history) {
        // 已办任务：历史记录的操作时间作为结束时间，状态统一为 COMPLETED
        return TaskResponse.builder()
                .id(history.getTaskId())
                .name(history.getName())
                .assignee(history.getAssignee())
                .processInstanceId(history.getProcessInstanceId())
                .processDefinitionId(null)
                .createTime(null)
                .endTime(history.getCreatedAt())
                .status(STATUS_COMPLETED)
                .build();
    }
}
