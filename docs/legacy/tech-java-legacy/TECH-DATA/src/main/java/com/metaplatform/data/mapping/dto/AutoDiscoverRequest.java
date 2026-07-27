package com.metaplatform.data.mapping.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 自动发现字段映射请求 — 根据数据源 schema 自动推荐字段映射。
 */
public record AutoDiscoverRequest(
        @NotBlank(message = "datasourceId 不能为空")
        String datasourceId,

        @NotBlank(message = "sourceTable 不能为空")
        String sourceTable,

        @NotBlank(message = "ontologyEntityId 不能为空")
        String ontologyEntityId
) {
}
