package com.metaplatform.agent.collaboration;

import com.metaplatform.agent.common.ApiResponse;
import com.metaplatform.agent.common.PageResponse;
import com.metaplatform.agent.common.TenantContext;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/**
 * 数字员工团队协作端点（V15-04）。
 */
@RestController
@RequestMapping("/api/v1/agent/collaboration")
@RequiredArgsConstructor
public class CollaborationController {

    private final CollaborationService collaborationService;

    @PostMapping("/tasks")
    public ApiResponse<CollaborationTask> create(@Valid @RequestBody CreateCollaborationRequest request) {
        return ApiResponse.success(collaborationService.create(
                TenantContext.getTenantIdOrDefault(), request, null));
    }

    @GetMapping("/tasks")
    public ApiResponse<PageResponse<CollaborationTask>> list(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        return ApiResponse.success(PageResponse.of(
                collaborationService.list(tenantId, status, page, pageSize),
                collaborationService.count(tenantId, status),
                page,
                pageSize));
    }

    @GetMapping("/tasks/{taskId}")
    public ApiResponse<CollaborationTask> get(@PathVariable String taskId) {
        return ApiResponse.success(collaborationService.get(
                TenantContext.getTenantIdOrDefault(), taskId));
    }

    @PostMapping("/tasks/{taskId}/execute")
    public ApiResponse<CollaborationTask> execute(@PathVariable String taskId) {
        return ApiResponse.success(collaborationService.execute(
                TenantContext.getTenantIdOrDefault(), taskId));
    }

    @GetMapping("/tasks/{taskId}/report")
    public ApiResponse<CollaborationReport> getReport(@PathVariable String taskId) {
        // 先验证任务存在
        collaborationService.get(TenantContext.getTenantIdOrDefault(), taskId);
        return ApiResponse.success(collaborationService.getReport(
                TenantContext.getTenantIdOrDefault(), taskId));
    }
}
