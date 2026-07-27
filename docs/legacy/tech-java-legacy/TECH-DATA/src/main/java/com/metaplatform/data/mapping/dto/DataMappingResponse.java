package com.metaplatform.data.mapping.dto;

import java.time.OffsetDateTime;

/**
 * 数据映射响应。
 */
public record DataMappingResponse(
        String mappingId,
        String name,
        String description,
        String datasourceId,
        String sourceTable,
        String ontologyEntityId,
        String status,
        String syncMode,
        String cronExpression,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
}
