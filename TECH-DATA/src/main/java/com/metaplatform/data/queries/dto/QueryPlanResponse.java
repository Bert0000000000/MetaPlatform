package com.metaplatform.data.queries.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * SQL 执行计划响应。
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class QueryPlanResponse {

    private String datasourceId;
    private String sql;
    private List<String> planSteps;
    private String estimatedCost;
    private OffsetDateTime plannedAt;
}
