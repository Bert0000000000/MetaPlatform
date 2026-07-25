package com.metaplatform.data.etl.dto;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * ETL 任务响应。
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EtlTaskResponse {

    private String id;
    private String tenantId;
    private String name;
    private String type;
    private String sourceDatasourceId;
    private String targetDatasourceId;
    private String sourceTable;
    private String targetTable;
    private JsonNode transformConfig;
    private String schedule;
    private String status;
    private String description;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
