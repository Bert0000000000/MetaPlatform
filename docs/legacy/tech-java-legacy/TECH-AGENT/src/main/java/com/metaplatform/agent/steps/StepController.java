package com.metaplatform.agent.steps;

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

import java.util.List;
import java.util.Map;

/**
 * 执行步骤 & 思维链端点。
 */
@RestController
@RequestMapping("/api/v1/agent/executions")
@RequiredArgsConstructor
public class StepController {

    private final StepService stepService;

    /**
     * 执行步骤列表。
     */
    @GetMapping("/{executionId}/steps")
    public ApiResponse<List<StepResponse>> getSteps(@PathVariable String executionId) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        return ApiResponse.success(stepService.getSteps(tenantId, executionId));
    }

    /**
     * 思维链。
     */
    @GetMapping("/{executionId}/thinking-chain")
    public ApiResponse<Map<String, Object>> getThinkingChain(@PathVariable String executionId) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        return ApiResponse.success(stepService.getThinkingChain(tenantId, executionId));
    }

    /**
     * 工具调用记录。
     */
    @GetMapping("/{executionId}/tool-calls")
    public ApiResponse<List<ToolCallResponse>> getToolCalls(@PathVariable String executionId) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        return ApiResponse.success(stepService.getToolCalls(tenantId, executionId));
    }

    /**
     * 提交评估。
     */
    @PostMapping("/{executionId}/evaluations")
    public ApiResponse<EvaluationResponse> submitEvaluation(@PathVariable String executionId,
                                                            @Valid @RequestBody SubmitEvaluationRequest request) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        return ApiResponse.success(stepService.submitEvaluation(tenantId, executionId, request));
    }

    /**
     * 评估列表。
     */
    @GetMapping("/{executionId}/evaluations")
    public ApiResponse<List<EvaluationResponse>> getEvaluations(@PathVariable String executionId) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        return ApiResponse.success(stepService.getEvaluations(tenantId, executionId));
    }
}
