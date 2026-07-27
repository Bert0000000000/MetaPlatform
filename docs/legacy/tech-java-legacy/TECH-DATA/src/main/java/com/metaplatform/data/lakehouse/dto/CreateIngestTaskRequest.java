package com.metaplatform.data.lakehouse.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Map;

/**
 * 创建数据摄入任务请求。
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CreateIngestTaskRequest {

    @NotBlank
    private String sourceDatasourceId;

    @NotBlank
    private String targetTableId;

    private String sourceTable;
    private String mode = "upsert";
    private Map<String, Object> config;
    private String schedule;
}
