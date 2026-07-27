package com.metaplatform.ont.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Cypher 查询执行结果（V12-05 REQ-062）。
 * columns: 列名顺序；rows: 每行以列名为键的 Map。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CypherExecuteResponse {

    private List<String> columns;

    private List<Map<String, Object>> rows;

    private long rowCount;

    private long durationMs;
}
