package com.metaplatform.data.mapping.dto;

import java.time.OffsetDateTime;

/**
 * 字段映射响应。
 */
public record MappingFieldResponse(
        String fieldId,
        String mappingId,
        String sourceField,
        String sourceType,
        String ontologyAttribute,
        String targetType,
        String transformExpression,
        Boolean isRequired,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
}
