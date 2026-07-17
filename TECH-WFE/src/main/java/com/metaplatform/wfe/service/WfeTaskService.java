package com.metaplatform.wfe.service;

import com.metaplatform.wfe.common.ErrorCode;
import com.metaplatform.wfe.common.PageResponse;
import com.metaplatform.wfe.common.TenantContext;
import com.metaplatform.wfe.common.TraceContext;
import com.metaplatform.wfe.dto.TaskActionRequest;
import com.metaplatform.wfe.dto.TaskActionResponse;
import com.metaplatform.wfe.dto.TaskResponse;
import com.metaplatform.wfe.exception.WfeException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.flowable.engine.HistoryService;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.TaskService;
import org.flowable.task.api.Task;
import org.flowable.task.api.TaskQuery;
import org.flowable.task.api.history.HistoricTaskInstance;
import org.flowable.task.api.history.HistoricTaskInstanceQuery;
import org.springframework.stereotype.Service;

import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class WfeTaskService {

    private final TaskService taskService;
    private final HistoryService historyService;
    private final RuntimeService runtimeService;
    private final IamIntegrationService iamIntegrationService;
    private final WfeOutboxService wfeOutboxService;

    // ════════════════════════════════════════════
    // P1-WFE-04: 任务查询
    // ════════════════════════════════════════════

    public PageResponse<TaskResponse> getTodoTasks(String userId, int page, int size) {
        int firstResult = Math.max(0, (page - 1) * size);
        int maxResults = Math.max(1, size);

        TaskQuery query = taskService.createTaskQuery()
                .taskAssignee(userId)
                .active()
                .orderByTaskCreateTime()
                .desc();

        long total = query.count();
        List<Task> tasks = query.listPage(firstResult, maxResults);

        List<TaskResponse> items = tasks.stream().map(this::toResponse).toList();

        return PageResponse.<TaskResponse>builder()
                .items(items)
                .total(total)
                .page(page)
                .pageSize(size)
                .totalPages((total + maxResults - 1) / maxResults)
                .build();
    }

    public PageResponse<TaskResponse> getDoneTasks(String userId, int page, int size) {
        int firstResult = Math.max(0, (page - 1) * size);
        int maxResults = Math.max(1, size);

        HistoricTaskInstanceQuery query = historyService.createHistoricTaskInstanceQuery()
                .taskAssignee(userId)
                .finished()
                .orderByHistoricTaskInstanceEndTime()
                .desc();

        long total = query.count();
        List<HistoricTaskInstance> tasks = query.listPage(firstResult, maxResults);

        List<TaskResponse> items = tasks.stream().map(this::toResponse).toList();

        return PageResponse.<TaskResponse>builder()
                .items(items)
                .total(total)
                .page(page)
                .pageSize(size)
                .totalPages((total + maxResults - 1) / maxResults)
                .build();
    }

    public TaskResponse getTaskById(String taskId) {
        HistoricTaskInstance task = historyService.createHistoricTaskInstanceQuery()
                .taskId(taskId)
                .singleResult();
        if (task == null) {
            throw new WfeException(ErrorCode.TASK_NOT_FOUND);
        }
        return toResponse(task);
    }

    public List<TaskResponse> getTasksByProcessInstance(String processInstanceId) {
        List<HistoricTaskInstance> tasks = historyService.createHistoricTaskInstanceQuery()
                .processInstanceId(processInstanceId)
                .orderByTaskCreateTime()
                .desc()
                .list();
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

        Task task = taskService.createTaskQuery().taskId(taskId).singleResult();
        if (task == null) {
            throw new WfeException(ErrorCode.TASK_NOT_FOUND);
        }

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
                case "APPROVE" -> doApprove(taskId, processInstanceId, comment);
                case "REJECT" -> doReject(taskId, processInstanceId, comment);
                case "TRANSFER" -> doTransfer(taskId, processInstanceId, comment, request.getTransferTo());
                case "RETURN" -> doReturn(taskId, processInstanceId, comment);
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
            Map<String, Object> payload = new HashMap<>();
            payload.put("taskId", taskId);
            payload.put("processInstanceId", processInstanceId);
            payload.put("action", action);
            payload.put("comment", comment);
            if (transferTo != null) {
                payload.put("transferTo", transferTo);
            }
            Map<String, String> headers = new HashMap<>();
            headers.put(TraceContext.TRACE_ID_HEADER, TraceContext.getOrCreate());
            wfeOutboxService.publishEvent(tenantId, taskId, eventType, payload, headers);
        } catch (Exception e) {
            log.warn("Failed to publish task event (non-blocking): taskId={}, action={}, error={}",
                    taskId, action, e.getMessage());
        }
    }

    private void doApprove(String taskId, String processInstanceId, String comment) {
        taskService.addComment(taskId, processInstanceId, comment);
        taskService.complete(taskId);
        log.info("Task approved: taskId={}, processInstanceId={}", taskId, processInstanceId);
    }

    private void doReject(String taskId, String processInstanceId, String comment) {
        taskService.addComment(taskId, processInstanceId, comment);
        if (processInstanceId != null) {
            runtimeService.deleteProcessInstance(processInstanceId, "REJECTED: " + comment);
        }
        log.info("Task rejected: taskId={}, processInstanceId={}", taskId, processInstanceId);
    }

    private void doTransfer(String taskId, String processInstanceId, String comment, String transferTo) {
        taskService.addComment(taskId, processInstanceId, comment);
        taskService.setAssignee(taskId, transferTo);
        log.info("Task transferred: taskId={}, from={}, to={}", taskId, comment, transferTo);
    }

    private void doReturn(String taskId, String processInstanceId, String comment) {
        taskService.addComment(taskId, processInstanceId, comment);
        taskService.complete(taskId, Map.of("action", "RETURN"));
        log.info("Task returned: taskId={}, processInstanceId={}", taskId, processInstanceId);
    }

    private boolean isValidAction(String action) {
        return "APPROVE".equals(action) || "REJECT".equals(action)
                || "TRANSFER".equals(action) || "RETURN".equals(action);
    }

    // ════════════════════════════════════════════
    // DTO 转换
    // ════════════════════════════════════════════

    private TaskResponse toResponse(Task task) {
        return TaskResponse.builder()
                .id(task.getId())
                .name(task.getName())
                .assignee(task.getAssignee())
                .processInstanceId(task.getProcessInstanceId())
                .processDefinitionId(task.getProcessDefinitionId())
                .createTime(toInstant(task.getCreateTime()))
                .endTime(null)
                .status("ACTIVE")
                .build();
    }

    private TaskResponse toResponse(HistoricTaskInstance task) {
        Date endTime = task.getEndTime();
        return TaskResponse.builder()
                .id(task.getId())
                .name(task.getName())
                .assignee(task.getAssignee())
                .processInstanceId(task.getProcessInstanceId())
                .processDefinitionId(task.getProcessDefinitionId())
                .createTime(toInstant(task.getCreateTime()))
                .endTime(toInstant(endTime))
                .status(endTime != null ? "COMPLETED" : "ACTIVE")
                .build();
    }

    private java.time.Instant toInstant(Date date) {
        return date != null ? date.toInstant() : null;
    }
}
