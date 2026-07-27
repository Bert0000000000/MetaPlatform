package com.metaplatform.data.datasources.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * 数据源连接测试结果。
 *
 * <p>对应 Python app/schemas/datasource.py 的 TestConnectionResult。</p>
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TestConnectionResponse {

    private boolean success;
    private String message;
    private String datasourceId;
    private String sourceType;
    private long latencyMs;
    private OffsetDateTime testedAt;
}
