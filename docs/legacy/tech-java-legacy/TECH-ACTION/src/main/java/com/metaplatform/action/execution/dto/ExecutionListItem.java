package com.metaplatform.action.execution.dto;

import java.time.Instant;

/**
 * 执行列表项。
 */
public record ExecutionListItem(
        String executionId,
        String actionId,
        String actionCode,
        String status,
        Instant startedAt,
        Instant completedAt,
        Integer durationMs,
        String retryOf,
        Integer retryCount
) {
}
