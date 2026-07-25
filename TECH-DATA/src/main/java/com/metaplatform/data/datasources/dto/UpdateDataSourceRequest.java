package com.metaplatform.data.datasources.dto;

import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Map;

/**
 * 更新数据源请求（部分字段可空）。
 *
 * <p>对应 Python app/api/v1/datasources.py 的 UpdateDataSourceRequest。</p>
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UpdateDataSourceRequest {

    @Size(max = 128)
    private String name;

    private Map<String, Object> connectionConfig;

    private String status;
}
