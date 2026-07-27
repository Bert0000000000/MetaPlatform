package com.metaplatform.action.execution.dto;

/**
 * 执行步骤响应。
 */
public record ExecutionStepResponse(
        String stepId,
        String actionId,
        String actionCode,
        String status,
        Integer durationMs,
        String errorMessage
) {
}
