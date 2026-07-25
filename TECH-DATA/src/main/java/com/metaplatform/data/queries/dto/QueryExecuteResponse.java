package com.metaplatform.data.queries.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * SQL 查询执行结果。
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class QueryExecuteResponse {

    private String queryId;
    private String datasourceId;
    private String sql;
    private List<String> columns;
    private List<Map<String, Object>> rows;
    private int rowCount;
    private long latencyMs;
    private OffsetDateTime executedAt;
    private boolean truncated;
}
