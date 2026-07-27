package com.metaplatform.data.datasources.dto;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * 数据源响应 DTO。
 *
 * <p>对应 Python app/schemas/datasource.py 的 DataSourceResponse。
 * connectionConfig 返回时去除敏感字段。</p>
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DataSourceResponse {

    private String id;
    private String tenantId;
    private String name;
    private String sourceType;
    private JsonNode connectionConfig;
    private String status;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
