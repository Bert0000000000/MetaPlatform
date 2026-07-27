package com.metaplatform.action.execution.dto;

import java.time.Instant;

/**
 * 中止执行响应。
 */
public record AbortExecutionResponse(
        String executionId,
        String status,
        Instant abortedAt,
        boolean withCompensation
) {
}
