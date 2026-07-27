package com.metaplatform.data.etl.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Map;

/**
 * 更新 ETL 任务请求（部分字段可空）。
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UpdateEtlTaskRequest {

    private String name;
    private Map<String, Object> transformConfig;
    private String schedule;
    private String status;
    private String description;
}
