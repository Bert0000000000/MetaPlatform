package com.metaplatform.data.warehouse.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 物化视图响应。
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MaterializedViewResponse {

    private String name;
    private String schema;
    private String baseSql;
    private String refreshMode;
    private String status;
    private long rowCount;
    private long sizeBytes;
    private OffsetDateTime lastRefreshedAt;
    private List<String> baseTables;
}
