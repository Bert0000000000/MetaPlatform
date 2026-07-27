package com.metaplatform.action.execution.service;

import com.metaplatform.action.common.ErrorCode;
import com.metaplatform.action.common.PageResponse;
import com.metaplatform.action.common.TenantContext;
import com.metaplatform.action.exception.ActionException;
import com.metaplatform.action.execution.dto.AbortExecutionRequest;
import com.metaplatform.action.execution.dto.AbortExecutionResponse;
import com.metaplatform.action.execution.dto.ExecutionDetailResponse;
import com.metaplatform.action.execution.dto.ExecutionListItem;
import com.metaplatform.action.execution.dto.ExecutionLogResponse;
import com.metaplatform.action.execution.dto.ExecutionStepResponse;
import com.metaplatform.action.execution.dto.RetryExecutionResponse;
import com.metaplatform.action.execution.dto.SyncExecutionRequest;
import com.metaplatform.action.execution.dto.SyncExecutionResponse;
import com.metaplatform.action.execution.entity.ExecutionEntity;
import com.metaplatform.action.execution.repository.ExecutionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Collections;
import java.util.List;

/**
 * 执行监控服务：执行历史审计、中止、重试（PRD REQ-3.3.4）。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ExecutionMonitorService {

    private static final String STATUS_PENDING = "PENDING";
    private static final String STATUS_COMPLETED = "COMPLETED";
    private static final String STATUS_FAILED = "FAILED";
    private static final String STATUS_ABORTING = "ABORTING";
    private static final String STATUS_ABORTED = "ABORTED";

    private final ExecutionRepository executionRepository;
    private final HttpExecutionService httpExecutionService;

    @Transactional(readOnly = true)
    public PageResponse<ExecutionListItem> list(String actionId, String status,
                                                 Instant startTime, Instant endTime,
                                                 int page, int size) {
        String tenantId = TenantContext.getOrDefault();
        PageRequest pageable = PageRequest.of(Math.max(page - 1, 0), size,
                Sort.by(Sort.Direction.DESC, "startedAt"));

        Page<ExecutionEntity> result = executionRepository.searchExecutions(
                tenantId,
                isBlank(actionId) ? null : actionId,
                isBlank(status) ? null : status,
                startTime,
                endTime,
                pageable);

        return PageResponse.<ExecutionListItem>builder()
                .items(result.getContent().stream().map(this::toListItem).toList())
                .total(result.getTotalElements())
                .page(page)
                .size(size)
                .totalPages(result.getTotalPages())
                .build();
    }

    @Transactional(readOnly = true)
    public ExecutionDetailResponse get(String executionId) {
        ExecutionEntity entity = requireExecution(executionId);
        return toDetailResponse(entity);
    }

    @Transactional
    public AbortExecutionResponse abort(String executionId, AbortExecutionRequest request) {
        ExecutionEntity entity = requireExecution(executionId);
        String status = entity.getStatus();
        if (STATUS_COMPLETED.equals(status) || STATUS_FAILED.equals(status) || STATUS_ABORTED.equals(status)) {
            throw new ActionException(ErrorCode.EXECUTION_ALREADY_FINISHED,
                    "执行已结束，不可中止: " + executionId + " (当前状态: " + status + ")");
        }

        Instant now = Instant.now();
        boolean withCompensation = request != null && Boolean.TRUE.equals(request.withCompensation());
        entity.setStatus(STATUS_ABORTING);
        entity.setAbortedAt(now);
        entity.setAbortedBy(TenantContext.getOrDefault());
        entity.setUpdatedAt(now);
        entity.setStatus(STATUS_ABORTED);
        entity.setCompletedAt(now);
        if (entity.getStartedAt() != null) {
            entity.setDurationMs((int) (now.toEpochMilli() - entity.getStartedAt().toEpochMilli()));
        }
        executionRepository.save(entity);

        if (withCompensation) {
            log.info("中止并执行补偿 | execution={} （补偿逻辑骨架，待接入 RemediationActionService）", executionId);
        }
        log.info("执行中止 | execution={} abortedBy={}", executionId, entity.getAbortedBy());
        return new AbortExecutionResponse(executionId, STATUS_ABORTED, now, withCompensation);
    }

    @Transactional
    public RetryExecutionResponse retry(String executionId) {
        ExecutionEntity original = requireExecution(executionId);
        String status = original.getStatus();
        if (!STATUS_FAILED.equals(status) && !STATUS_ABORTED.equals(status)) {
            throw new ActionException(ErrorCode.EXECUTION_CANNOT_RETRY,
                    "仅失败或已中止的执行可重试: " + executionId + " (当前状态: " + status + ")");
        }

        Object input = original.getInput();
        SyncExecutionRequest execRequest = new SyncExecutionRequest();
        execRequest.setActionCode(original.getActionCode());
        execRequest.setInput(input);

        SyncExecutionResponse execResp = httpExecutionService.executeSync(execRequest);

        executionRepository.findByExecutionIdAndTenantId(execResp.getExecutionId(), original.getTenantId())
                .ifPresent(newExec -> {
                    newExec.setRetryOf(executionId);
                    newExec.setRetryCount((original.getRetryCount() != null ? original.getRetryCount() : 0) + 1);
                    executionRepository.save(newExec);
                });

        log.info("执行重试 | original={} new={} retryCount={}",
                executionId, execResp.getExecutionId(),
                (original.getRetryCount() != null ? original.getRetryCount() : 0) + 1);
        return new RetryExecutionResponse(
                execResp.getExecutionId(),
                executionId,
                (original.getRetryCount() != null ? original.getRetryCount() : 0) + 1,
                execResp.getStatus(),
                execResp.getStartedAt());
    }

    @Transactional(readOnly = true)
    public List<ExecutionStepResponse> listSteps(String executionId) {
        ExecutionEntity entity = requireExecution(executionId);
        return List.of(new ExecutionStepResponse(
                entity.getExecutionId(),
                entity.getActionId(),
                entity.getActionCode(),
                entity.getStatus(),
                entity.getDurationMs(),
                entity.getErrorMessage()));
    }

    @Transactional(readOnly = true)
    public List<ExecutionLogResponse> listLogs(String executionId, String level) {
        ExecutionEntity entity = requireExecution(executionId);
        List<ExecutionLogResponse> logs = new java.util.ArrayList<>();
        if (entity.getStartedAt() != null) {
            logs.add(new ExecutionLogResponse(entity.getStartedAt(), "INFO",
                    entity.getActionCode(), "执行开始"));
        }
        if (STATUS_FAILED.equals(entity.getStatus()) && entity.getErrorMessage() != null) {
            logs.add(new ExecutionLogResponse(
                    entity.getCompletedAt() != null ? entity.getCompletedAt() : entity.getStartedAt(),
                    "ERROR", entity.getActionCode(), entity.getErrorMessage()));
        }
        if (entity.getCompletedAt() != null && STATUS_COMPLETED.equals(entity.getStatus())) {
            logs.add(new ExecutionLogResponse(entity.getCompletedAt(), "INFO",
                    entity.getActionCode(), "执行完成"));
        }
        if (STATUS_ABORTED.equals(entity.getStatus()) && entity.getAbortedAt() != null) {
            logs.add(new ExecutionLogResponse(entity.getAbortedAt(), "WARN",
                    entity.getActionCode(), "执行被中止"));
        }
        if (isBlank(level)) {
            return logs;
        }
        return logs.stream().filter(l -> level.equalsIgnoreCase(l.level())).toList();
    }

    // =====================================================================
    // 内部辅助方法
    // =====================================================================

    private ExecutionEntity requireExecution(String executionId) {
        String tenantId = TenantContext.getOrDefault();
        return executionRepository.findByExecutionIdAndTenantId(executionId, tenantId)
                .orElseThrow(() -> new ActionException(ErrorCode.EXECUTION_NOT_FOUND,
                        "执行记录不存在: " + executionId));
    }

    private ExecutionListItem toListItem(ExecutionEntity entity) {
        return new ExecutionListItem(
                entity.getExecutionId(),
                entity.getActionId(),
                entity.getActionCode(),
                entity.getStatus(),
                entity.getStartedAt(),
                entity.getCompletedAt(),
                entity.getDurationMs(),
                entity.getRetryOf(),
                entity.getRetryCount());
    }

    private ExecutionDetailResponse toDetailResponse(ExecutionEntity entity) {
        return new ExecutionDetailResponse(
                entity.getExecutionId(),
                entity.getActionId(),
                entity.getActionCode(),
                entity.getStatus(),
                entity.getInput(),
                entity.getOutput(),
                entity.getErrorCode(),
                entity.getErrorMessage(),
                entity.getTraceId(),
                entity.getStartedAt(),
                entity.getCompletedAt(),
                entity.getDurationMs(),
                entity.getAbortedAt(),
                entity.getAbortedBy(),
                entity.getRetryOf(),
                entity.getRetryCount(),
                Collections.emptyList(),
                Collections.emptyList());
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}