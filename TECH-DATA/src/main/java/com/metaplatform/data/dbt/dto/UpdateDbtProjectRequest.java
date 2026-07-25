package com.metaplatform.data.dbt.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Map;

/**
 * 更新 dbt 项目请求。
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UpdateDbtProjectRequest {

    private String name;
    private String projectDir;
    private String profilesYml;
    private Map<String, Object> config;
    private String description;
    private String status;
}
