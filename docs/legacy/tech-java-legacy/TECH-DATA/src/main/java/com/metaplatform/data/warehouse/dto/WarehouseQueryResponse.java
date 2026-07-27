package com.metaplatform.data.warehouse.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * 数据仓库查询响应。
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WarehouseQueryResponse {

    private String queryId;
    private String layer;
    private String sql;
    private List<String> columns;
    private List<Map<String, Object>> rows;
    private int rowCount;
    private long latencyMs;
    private OffsetDateTime executedAt;
}
