package com.metaplatform.action.execution.dto;

import java.time.Instant;

/**
 * 重试执行响应。
 */
public record RetryExecutionResponse(
        String executionId,
        String retryOf,
        Integer retryCount,
        String status,
        Instant startedAt
) {
}
