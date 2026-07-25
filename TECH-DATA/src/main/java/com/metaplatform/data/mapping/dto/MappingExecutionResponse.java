package com.metaplatform.data.mapping.dto;

import java.time.OffsetDateTime;

/**
 * 映射执行记录响应（同步日志）。
 */
public record MappingExecutionResponse(
        String executionId,
        String mappingId,
        String status,
        Long recordsProcessed,
        Long recordsFailed,
        OffsetDateTime startedAt,
        OffsetDateTime finishedAt,
        String errorMessage
) {
}
