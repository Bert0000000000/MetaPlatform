package com.metaplatform.agent.plans;

import com.metaplatform.agent.common.ApiResponse;
import com.metaplatform.agent.common.PageResponse;
import com.metaplatform.agent.common.TenantContext;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/**
 * 自主任务计划端点（V15-02）。
 */
@RestController
@RequestMapping("/api/v1/agent/plans")
@RequiredArgsConstructor
public class PlanController {

    private final PlanService planService;

    @PostMapping
    public ApiResponse<Plan> create(@Valid @RequestBody CreatePlanRequest request) {
        return ApiResponse.success(planService.create(TenantContext.getTenantIdOrDefault(), request));
    }

    @GetMapping
    public ApiResponse<PageResponse<Plan>> list(
            @RequestParam(required = false) String agentId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        return ApiResponse.success(PageResponse.of(
                planService.list(tenantId, agentId, page, pageSize),
                planService.count(tenantId, agentId),
                page,
                pageSize));
    }

    @GetMapping("/{planId}")
    public ApiResponse<Plan> get(@PathVariable String planId) {
        return ApiResponse.success(planService.get(TenantContext.getTenantIdOrDefault(), planId));
    }

    @PostMapping("/{planId}/steps/{stepId}/approve")
    public ApiResponse<Plan> approveStep(
            @PathVariable String planId,
            @PathVariable String stepId) {
        return ApiResponse.success(planService.approveStep(
                TenantContext.getTenantIdOrDefault(), planId, stepId));
    }

    @PostMapping("/{planId}/steps/{stepId}/skip")
    public ApiResponse<Plan> skipStep(
            @PathVariable String planId,
            @PathVariable String stepId) {
        return ApiResponse.success(planService.skipStep(
                TenantContext.getTenantIdOrDefault(), planId, stepId));
    }

    @PostMapping("/{planId}/execute")
    public ApiResponse<Plan> execute(@PathVariable String planId) {
        return ApiResponse.success(planService.execute(
                TenantContext.getTenantIdOrDefault(), planId));
    }
}
