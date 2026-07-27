package com.metaplatform.action.execution.dto;

import java.time.Instant;

/**
 * 执行日志条目。
 */
public record ExecutionLogResponse(
        Instant timestamp,
        String level,
        String step,
        String message
) {
}
