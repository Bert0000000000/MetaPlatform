package com.metaplatform.data.etl.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Map;

/**
 * 创建 ETL 任务请求。
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CreateEtlTaskRequest {

    @NotBlank
    @Size(max = 128)
    private String name;

    @NotBlank
    @Size(max = 32)
    private String type;

    @NotBlank
    private String sourceDatasourceId;

    @NotBlank
    private String targetDatasourceId;

    private String sourceTable;
    private String targetTable;
    private Map<String, Object> transformConfig;
    private String schedule;
    private String description = "";
}
