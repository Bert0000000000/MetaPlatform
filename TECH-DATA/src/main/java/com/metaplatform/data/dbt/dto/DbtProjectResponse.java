package com.metaplatform.data.dbt.dto;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * dbt 项目响应。
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DbtProjectResponse {

    private String id;
    private String tenantId;
    private String name;
    private String targetDatasourceId;
    private String projectDir;
    private String profilesYml;
    private JsonNode config;
    private String status;
    private String description;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
