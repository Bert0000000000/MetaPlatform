package com.metaplatform.data.lakehouse.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Map;

/**
 * 创建数据湖表请求。
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CreateLakeTableRequest {

    @NotBlank
    @Size(max = 128)
    private String name;

    @NotBlank
    private String database;

    @NotBlank
    private String format;

    private String description = "";
    private Map<String, Object> schema;
    private Map<String, Object> partitionSpec;
}
