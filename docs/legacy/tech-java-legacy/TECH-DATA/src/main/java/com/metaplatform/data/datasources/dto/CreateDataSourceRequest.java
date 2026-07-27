package com.metaplatform.data.datasources.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Map;

/**
 * 创建数据源请求。
 *
 * <p>对应 Python app/api/v1/datasources.py 的 CreateDataSourceRequest。</p>
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CreateDataSourceRequest {

    @NotBlank
    @Size(max = 128)
    private String name;

    @NotBlank
    @Size(max = 32)
    private String sourceType;

    @NotBlank
    private Map<String, Object> connectionConfig;

    /** 初始状态，默认 ACTIVE。 */
    private String status = "ACTIVE";
}
