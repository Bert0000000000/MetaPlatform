package com.metaplatform.data.datasources.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Map;

/**
 * 数据源连接测试请求。
 *
 * <p>支持两种模式：通过 datasourceId 测试已存在的数据源，或直接传 sourceType + connectionConfig 现场测试。</p>
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class TestConnectionRequest {

    /** 已存在数据源 ID（与 sourceType+connectionConfig 二选一）。 */
    private String datasourceId;

    @Size(max = 32)
    private String sourceType;

    private Map<String, Object> connectionConfig;
}
