package com.metaplatform.agent.checkpoint;

import com.metaplatform.agent.common.ApiResponse;
import com.metaplatform.agent.common.TenantContext;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.Optional;

/**
 * 检查点端点。
 */
@RestController
@RequestMapping("/api/v1/agent/executions")
@RequiredArgsConstructor
public class CheckpointController {

    private final CheckpointService checkpointService;

    /**
     * 保存执行检查点。
     */
    @PostMapping("/{executionId}/checkpoint")
    public ApiResponse<CheckpointResponse> saveCheckpoint(@PathVariable String executionId,
                                                          @Valid @RequestBody SaveCheckpointRequest request) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        CheckpointResponse checkpoint = checkpointService.save(
                tenantId, executionId, request.getAgentId(), request.getState());
        return ApiResponse.success(checkpoint);
    }

    /**
     * 加载执行检查点。
     */
    @GetMapping("/{executionId}/checkpoint")
    public ApiResponse<CheckpointResponse> loadCheckpoint(@PathVariable String executionId) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        Optional<CheckpointResponse> checkpoint = checkpointService.load(tenantId, executionId);
        return ApiResponse.success(checkpoint.orElse(null));
    }

    /**
     * 从检查点恢复执行。
     */
    @PostMapping("/{executionId}/resume")
    public ApiResponse<Map<String, Object>> resumeFromCheckpoint(@PathVariable String executionId) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        Optional<CheckpointResponse> checkpoint = checkpointService.load(tenantId, executionId);
        if (checkpoint.isEmpty()) {
            return ApiResponse.success(Map.of("resumed", false, "reason", "no checkpoint found"));
        }
        return ApiResponse.success(Map.of("resumed", true, "checkpoint", checkpoint.get()));
    }
}
