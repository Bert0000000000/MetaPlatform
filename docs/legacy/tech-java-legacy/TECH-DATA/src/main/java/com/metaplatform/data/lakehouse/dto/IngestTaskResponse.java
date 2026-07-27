package com.metaplatform.data.lakehouse.dto;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * 数据摄入任务响应。
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class IngestTaskResponse {

    private String id;
    private String tenantId;
    private String sourceDatasourceId;
    private String targetTableId;
    private String sourceTable;
    private String mode;
    private JsonNode config;
    private String schedule;
    private String status;
    private OffsetDateTime lastRunAt;
    private String lastRunStatus;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
