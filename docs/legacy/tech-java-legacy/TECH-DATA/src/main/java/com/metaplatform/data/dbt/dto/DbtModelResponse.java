package com.metaplatform.data.dbt.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * dbt 模型响应。
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DbtModelResponse {

    private String modelId;
    private String projectId;
    private String name;
    private String resourceType;
    private String materialized;
    private String schema;
    private String alias;
    private String sql;
    private String description;
    private String status;
}
