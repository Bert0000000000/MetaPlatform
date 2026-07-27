package com.metaplatform.agent.tasks;

import com.metaplatform.agent.common.ApiResponse;
import com.metaplatform.agent.common.PageResponse;
import com.metaplatform.agent.common.TenantContext;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Agent 任务管理端点。
 */
@RestController
@RequestMapping("/api/v1/agent/tasks")
@RequiredArgsConstructor
public class TaskController {

    private final TaskService taskService;

    @PostMapping
    public ApiResponse<TaskResponse> create(@Valid @RequestBody CreateTaskRequest request) {
        return ApiResponse.success(taskService.create(TenantContext.getTenantIdOrDefault(), request));
    }

    @GetMapping
    public ApiResponse<PageResponse<TaskResponse>> list(
            @RequestParam(required = false) String agentId,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        return ApiResponse.success(taskService.list(
                TenantContext.getTenantIdOrDefault(), agentId, status, page, pageSize));
    }

    @GetMapping("/statistics")
    public ApiResponse<TaskStatistics> getStatistics(@RequestParam String agentId) {
        return ApiResponse.success(taskService.getStatistics(
                TenantContext.getTenantIdOrDefault(), agentId));
    }

    @GetMapping("/{taskId}")
    public ApiResponse<TaskResponse> get(@PathVariable String taskId) {
        return ApiResponse.success(taskService.get(TenantContext.getTenantIdOrDefault(), taskId));
    }

    @GetMapping("/{taskId}/result")
    public ApiResponse<Map<String, Object>> getResult(@PathVariable String taskId) {
        return ApiResponse.success(Map.of("output",
                taskService.getTaskResult(TenantContext.getTenantIdOrDefault(), taskId)));
    }

    @PatchMapping("/{taskId}/status")
    public ApiResponse<TaskResponse> updateStatus(
            @PathVariable String taskId,
            @Valid @RequestBody UpdateTaskStatusRequest request) {
        return ApiResponse.success(taskService.updateStatus(
                TenantContext.getTenantIdOrDefault(), taskId, request));
    }

    @PostMapping("/{taskId}/assign")
    public ApiResponse<TaskResponse> assign(
            @PathVariable String taskId,
            @Valid @RequestBody AssignTaskRequest request) {
        return ApiResponse.success(taskService.assign(
                TenantContext.getTenantIdOrDefault(), taskId, request.getAssignedTo()));
    }
}
