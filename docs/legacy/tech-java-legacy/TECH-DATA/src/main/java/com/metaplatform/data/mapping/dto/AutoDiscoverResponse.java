package com.metaplatform.data.mapping.dto;

import java.util.List;

/**
 * 自动发现字段映射结果。
 */
public record AutoDiscoverResponse(
        String datasourceId,
        String sourceTable,
        String ontologyEntityId,
        List<MappingFieldResponse> recommendedFields
) {
}
