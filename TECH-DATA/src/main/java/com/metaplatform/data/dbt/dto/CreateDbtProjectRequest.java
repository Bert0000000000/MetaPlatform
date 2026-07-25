package com.metaplatform.data.dbt.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Map;

/**
 * 创建 dbt 项目请求。
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CreateDbtProjectRequest {

    @NotBlank
    @Size(max = 128)
    private String name;

    @NotBlank
    private String targetDatasourceId;

    private String projectDir = "";
    private String profilesYml = "";
    private Map<String, Object> config;
    private String description = "";
}
