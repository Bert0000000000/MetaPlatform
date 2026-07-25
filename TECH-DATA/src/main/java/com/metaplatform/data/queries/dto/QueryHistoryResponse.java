package com.metaplatform.data.queries.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * 查询历史记录。
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class QueryHistoryResponse {

    private String queryId;
    private String datasourceId;
    private String sql;
    private int rowCount;
    private long latencyMs;
    private String status;
    private String executedBy;
    private OffsetDateTime executedAt;
}
