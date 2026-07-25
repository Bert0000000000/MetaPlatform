package com.metaplatform.action.execution.controller;

import com.metaplatform.action.common.ApiResponse;
import com.metaplatform.action.common.PageResponse;
import com.metaplatform.action.execution.dto.AbortExecutionRequest;
import com.metaplatform.action.execution.dto.AbortExecutionResponse;
import com.metaplatform.action.execution.dto.ExecutionDetailResponse;
import com.metaplatform.action.execution.dto.ExecutionListItem;
import com.metaplatform.action.execution.dto.ExecutionLogResponse;
import com.metaplatform.action.execution.dto.ExecutionStepResponse;
import com.metaplatform.action.execution.dto.RetryExecutionResponse;
import com.metaplatform.action.execution.dto.SyncExecutionRequest;
import com.metaplatform.action.execution.dto.SyncExecutionResponse;
import com.metaplatform.action.execution.service.ExecutionMonitorService;
import com.metaplatform.action.execution.service.HttpExecutionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;

/**
 * Action 执行端点 — 同步执行 + 执行监控（PRD REQ-3.3.4 / REQ-3.3.6）。
 *
 * <p>路径：{@code /api/v1/action/executions}</p>
 */
@RestController
@RequestMapping("/api/v1/action/executions")
@RequiredArgsConstructor
public class ExecutionController {

    private final HttpExecutionService httpExecutionService;
    private final ExecutionMonitorService executionMonitorService;

    /**
     * 同步执行 Action。
     */
    @PostMapping("/sync")
    public ApiResponse<SyncExecutionResponse> executeSync(@Valid @RequestBody SyncExecutionRequest request) {
        return ApiResponse.success(httpExecutionService.executeSync(request));
    }

    // =====================================================================
    // 执行监控
    // =====================================================================

    /**
     * 执行列表（分页 + 过滤）。
     */
    @GetMapping
    public ApiResponse<PageResponse<ExecutionListItem>> list(
            @RequestParam(required = false) String actionId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Instant startTime,
            @RequestParam(required = false) Instant endTime,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success(executionMonitorService.list(actionId, status, startTime, endTime, page, size));
    }

    /**
     * 执行详情。
     */
    @GetMapping("/{executionId}")
    public ApiResponse<ExecutionDetailResponse> get(@PathVariable String executionId) {
        return ApiResponse.success(executionMonitorService.get(executionId));
    }

    /**
     * 中止执行。
     */
    @PostMapping("/{executionId}/abort")
    public ApiResponse<AbortExecutionResponse> abort(
            @PathVariable String executionId,
            @RequestBody(required = false) AbortExecutionRequest request) {
        return ApiResponse.success(executionMonitorService.abort(executionId, request));
    }

    /**
     * 重试执行。
     */
    @PostMapping("/{executionId}/retry")
    public ApiResponse<RetryExecutionResponse> retry(@PathVariable String executionId) {
        return ApiResponse.success(executionMonitorService.retry(executionId));
    }

    /**
     * 执行步骤。
     */
    @GetMapping("/{executionId}/steps")
    public ApiResponse<List<ExecutionStepResponse>> listSteps(@PathVariable String executionId) {
        return ApiResponse.success(executionMonitorService.listSteps(executionId));
    }

    /**
     * 执行日志（支持 level 过滤）。
     */
    @GetMapping("/{executionId}/logs")
    public ApiResponse<List<ExecutionLogResponse>> listLogs(
            @PathVariable String executionId,
            @RequestParam(required = false) String level) {
        return ApiResponse.success(executionMonitorService.listLogs(executionId, level));
    }
}
