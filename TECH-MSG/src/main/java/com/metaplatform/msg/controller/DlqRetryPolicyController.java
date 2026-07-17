package com.metaplatform.msg.controller;

import com.metaplatform.msg.common.ApiResponse;
import com.metaplatform.msg.dto.CleanupRequest;
import com.metaplatform.msg.dto.CleanupResponse;
import com.metaplatform.msg.dto.RetryPolicyRequest;
import com.metaplatform.msg.dto.RetryPolicyResponse;
import com.metaplatform.msg.service.DlqRetryPolicyService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/msg/dlq")
@RequiredArgsConstructor
public class DlqRetryPolicyController {

    private final DlqRetryPolicyService dlqRetryPolicyService;

    @PutMapping("/policies")
    public ApiResponse<RetryPolicyResponse> createOrUpdate(@Valid @RequestBody RetryPolicyRequest request) {
        return ApiResponse.success(dlqRetryPolicyService.createOrUpdate(
                request.getTenantId(), request.getTopic(), request.getMaxRetries(),
                request.getRetryIntervalSeconds(), request.getRetryBackoffMultiplier(),
                request.getAutoCleanupDays()));
    }

    @GetMapping("/policies")
    public ApiResponse<List<RetryPolicyResponse>> list(@RequestParam(required = false) String tenantId) {
        return ApiResponse.success(dlqRetryPolicyService.list(tenantId));
    }

    @GetMapping("/policies/{topic}")
    public ApiResponse<RetryPolicyResponse> getByTopic(
            @RequestParam(required = false) String tenantId,
            @PathVariable String topic) {
        return ApiResponse.success(dlqRetryPolicyService.getByTopic(tenantId, topic));
    }

    @DeleteMapping("/policies/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        dlqRetryPolicyService.delete(id);
        return ApiResponse.success();
    }

    @PostMapping("/cleanup")
    public ApiResponse<CleanupResponse> cleanup(@Valid @RequestBody CleanupRequest request) {
        return ApiResponse.success(dlqRetryPolicyService.cleanupExpired(request.getTenantId()));
    }
}
