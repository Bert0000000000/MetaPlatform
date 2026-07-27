package com.metaplatform.data.catalog.dto;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 数据目录资产响应。
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CatalogAssetResponse {

    private String assetId;
    private String tenantId;
    private String type;
    private String name;
    private String source;
    private String description;
    private String owner;
    private List<String> tags;
    private JsonNode metadata;
    private String status;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
