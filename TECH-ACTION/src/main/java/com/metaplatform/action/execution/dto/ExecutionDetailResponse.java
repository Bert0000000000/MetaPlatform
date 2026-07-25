package com.metaplatform.action.execution.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * 执行详情响应（含步骤与日志摘要）。
 */
public record ExecutionDetailResponse(
        String executionId,
        String actionId,
        String actionCode,
        String status,
        Map<String, Object> input,
        Map<String, Object> output,
        String errorCode,
        String errorMessage,
        String traceId,
        Instant startedAt,
        Instant completedAt,
        Integer durationMs,
        Instant abortedAt,
        String abortedBy,
        String retryOf,
        Integer retryCount,
        List<ExecutionStepResponse> steps,
        List<ExecutionLogResponse> logs
) {
}