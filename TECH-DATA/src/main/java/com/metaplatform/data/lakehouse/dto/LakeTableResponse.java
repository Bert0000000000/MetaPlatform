package com.metaplatform.data.lakehouse.dto;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * 数据湖表响应。
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LakeTableResponse {

    private String id;
    private String tenantId;
    private String name;
    private String database;
    private String format;
    private String description;
    private JsonNode schema;
    private JsonNode partitionSpec;
    private long rowCount;
    private long sizeBytes;
    private String status;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
