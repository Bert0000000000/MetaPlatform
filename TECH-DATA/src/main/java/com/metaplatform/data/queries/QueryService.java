package com.metaplatform.data.queries;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.data.common.ErrorCode;
import com.metaplatform.data.common.PageResponse;
import com.metaplatform.data.common.TenantContext;
import com.metaplatform.data.config.DataProperties;
import com.metaplatform.data.datasources.support.DataSourceManager;
import com.metaplatform.data.exception.DataException;
import com.metaplatform.data.queries.dto.ExecuteQueryRequest;
import com.metaplatform.data.queries.dto.QueryExecuteResponse;
import com.metaplatform.data.queries.dto.QueryHistoryResponse;
import com.metaplatform.data.queries.dto.QueryPlanResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * SQL 查询服务：read-only 校验 + 真实 JDBC 执行 + 计划 + 导出 + 历史。
 *
 * <p>对应 Python app/services/query_service.py 的 QueryService。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class QueryService {

    private static final List<String> FORBIDDEN_KEYWORDS = List.of(
            "insert", "update", "delete", "drop", "alter", "truncate", "create", "grant", "revoke", "merge");
    private static final int HISTORY_MAX_SIZE = 200;
    /** 从 EXPLAIN 输出中提取 rows=N 的正则。 */
    private static final Pattern ROWS_PATTERN = Pattern.compile("rows=(\\d+)", Pattern.CASE_INSENSITIVE);

    private final DataSourceManager dataSourceManager;
    private final DataProperties dataProperties;
    private final ObjectMapper objectMapper;
    /** 简单内存历史记录（按租户隔离）。 */
    private final Map<String, ConcurrentLinkedDeque<QueryHistoryResponse>> historyStore = new ConcurrentHashMap<>();

    /**
     * 执行 SQL 查询（仅允许 SELECT）。
     */
    public QueryExecuteResponse execute(ExecuteQueryRequest request) {
        validateReadOnlySql(request.getSql());
        String datasourceId = request.getDatasourceId();
        int maxRows = request.getMaxRows() != null ? request.getMaxRows() : dataProperties.getQueryMaxRows();

        long start = System.currentTimeMillis();
        List<String> columns = new ArrayList<>();
        List<Map<String, Object>> rows = new ArrayList<>();
        boolean truncated = false;
        String queryId = "q-" + UUID.randomUUID().toString().replace("-", "");

        try (Connection conn = dataSourceManager.getConnection(datasourceId);
             Statement stmt = conn.createStatement()) {
            stmt.setQueryTimeout(dataProperties.getQueryTimeoutSeconds());
            stmt.setMaxRows(maxRows + 1); // 多取一行用于判断是否截断

            try (ResultSet rs = stmt.executeQuery(request.getSql())) {
                ResultSetMetaData metaData = rs.getMetaData();
                int columnCount = metaData.getColumnCount();
                for (int i = 1; i <= columnCount; i++) {
                    columns.add(metaData.getColumnLabel(i));
                }

                while (rs.next()) {
                    if (rows.size() >= maxRows) {
                        truncated = true;
                        break;
                    }
                    Map<String, Object> row = new LinkedHashMap<>();
                    for (int i = 1; i <= columnCount; i++) {
                        row.put(columns.get(i - 1), rs.getObject(i));
                    }
                    rows.add(row);
                }
            }
        } catch (SQLException e) {
            long latency = System.currentTimeMillis() - start;
            log.warn("查询执行失败 | ds={} sql={} error={}", datasourceId, request.getSql(), e.getMessage());
            recordHistory(datasourceId, request.getSql(), 0, latency, "FAILED");
            throw new DataException(ErrorCode.DATA_SOURCE_ERROR,
                    "SQL 执行失败: " + e.getMessage(), e);
        }

        long latency = System.currentTimeMillis() - start;
        QueryExecuteResponse response = QueryExecuteResponse.builder()
                .queryId(queryId)
                .datasourceId(datasourceId)
                .sql(request.getSql())
                .columns(columns)
                .rows(rows)
                .rowCount(rows.size())
                .latencyMs(latency)
                .executedAt(OffsetDateTime.now())
                .truncated(truncated)
                .build();

        recordHistory(datasourceId, request.getSql(), rows.size(), latency, "SUCCESS");
        log.info("查询执行 | tenant={} ds={} queryId={} rows={} maxRows={} truncated={}",
                TenantContext.getTenantIdOrDefault(), datasourceId, queryId, rows.size(), maxRows, truncated);
        return response;
    }

    /**
     * 查询执行计划：通过 EXPLAIN 获取真实执行计划。
     */
    public QueryPlanResponse plan(String datasourceId, String sql) {
        validateReadOnlySql(sql);
        long start = System.currentTimeMillis();
        List<String> planSteps = new ArrayList<>();

        try (Connection conn = dataSourceManager.getConnection(datasourceId);
             Statement stmt = conn.createStatement()) {
            stmt.setQueryTimeout(dataProperties.getQueryTimeoutSeconds());
            try (ResultSet rs = stmt.executeQuery("EXPLAIN " + sql)) {
                ResultSetMetaData metaData = rs.getMetaData();
                int columnCount = metaData.getColumnCount();
                while (rs.next()) {
                    StringBuilder sb = new StringBuilder();
                    for (int i = 1; i <= columnCount; i++) {
                        if (i > 1) sb.append(" | ");
                        sb.append(rs.getString(i));
                    }
                    planSteps.add(sb.toString());
                }
            }
        } catch (SQLException e) {
            log.warn("查询计划失败 | ds={} sql={} error={}", datasourceId, sql, e.getMessage());
            throw new DataException(ErrorCode.DATA_SOURCE_ERROR,
                    "EXPLAIN 执行失败: " + e.getMessage(), e);
        }

        long latency = System.currentTimeMillis() - start;
        String estimatedCost = estimateCost(planSteps);
        log.info("查询计划 | ds={} sql={} steps={} cost={} latency={}ms",
                datasourceId, sql, planSteps.size(), estimatedCost, latency);

        return QueryPlanResponse.builder()
                .datasourceId(datasourceId)
                .sql(sql)
                .planSteps(planSteps)
                .estimatedCost(estimatedCost)
                .plannedAt(OffsetDateTime.now())
                .build();
    }

    /**
     * 导出查询结果为 CSV / JSON 字符串。
     */
    public String export(String datasourceId, String sql, String format) {
        ExecuteQueryRequest execReq = new ExecuteQueryRequest(datasourceId, sql, null);
        QueryExecuteResponse result = execute(execReq);

        String fmt = format != null ? format.toLowerCase() : "csv";
        return switch (fmt) {
            case "csv" -> toCsv(result.getColumns(), result.getRows());
            case "json" -> toJson(result.getRows());
            default -> throw DataException.invalidParam("不支持的导出格式: " + format);
        };
    }

    /**
     * 历史记录（按租户 + 数据源可选）。
     */
    public PageResponse<QueryHistoryResponse> history(String datasourceId, int page, int pageSize) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        ConcurrentLinkedDeque<QueryHistoryResponse> deque = historyStore.get(tenantId);
        if (deque == null || deque.isEmpty()) {
            return PageResponse.empty(page, pageSize);
        }
        List<QueryHistoryResponse> all = new ArrayList<>(deque);
        if (datasourceId != null && !datasourceId.isBlank()) {
            all = all.stream().filter(h -> datasourceId.equals(h.getDatasourceId())).toList();
        }
        int total = all.size();
        int from = Math.min((page - 1) * pageSize, total);
        int to = Math.min(from + pageSize, total);
        List<QueryHistoryResponse> slice = from < to ? all.subList(from, to) : Collections.emptyList();
        return PageResponse.of(slice, total, page, pageSize);
    }

    // =====================================================================
    // 内部辅助方法
    // =====================================================================

    /**
     * 将查询结果转为 CSV 字符串。
     */
    private String toCsv(List<String> columns, List<Map<String, Object>> rows) {
        StringBuilder sb = new StringBuilder();
        // 表头
        sb.append(String.join(",", columns)).append("\n");
        // 数据行
        for (Map<String, Object> row : rows) {
            List<String> values = new ArrayList<>(columns.size());
            for (String col : columns) {
                Object v = row.get(col);
                values.add(toCsvCell(v));
            }
            sb.append(String.join(",", values)).append("\n");
        }
        return sb.toString();
    }

    private String toCsvCell(Object value) {
        if (value == null) return "";
        String s = String.valueOf(value);
        // 包含逗号、双引号或换行符时，用双引号包裹并转义内部双引号
        if (s.contains(",") || s.contains("\"") || s.contains("\n") || s.contains("\r")) {
            return "\"" + s.replace("\"", "\"\"") + "\"";
        }
        return s;
    }

    /**
     * 将查询结果转为 JSON 字符串。
     */
    private String toJson(List<Map<String, Object>> rows) {
        try {
            return objectMapper.writeValueAsString(rows);
        } catch (JsonProcessingException e) {
            throw new DataException(ErrorCode.INTERNAL_ERROR, "JSON 序列化失败: " + e.getMessage(), e);
        }
    }

    /**
     * 基于行数估算查询成本：LOW（<1000）/ MEDIUM（<100000）/ HIGH。
     */
    private String estimateCost(List<String> planSteps) {
        long maxRows = 0;
        for (String step : planSteps) {
            Matcher m = ROWS_PATTERN.matcher(step);
            if (m.find()) {
                try {
                    maxRows = Math.max(maxRows, Long.parseLong(m.group(1)));
                } catch (NumberFormatException ignored) {
                    // 忽略解析失败
                }
            }
        }
        if (maxRows < 1000) return "LOW";
        if (maxRows < 100_000) return "MEDIUM";
        return "HIGH";
    }

    private void validateReadOnlySql(String sql) {
        if (sql == null || sql.isBlank()) {
            throw DataException.invalidParam("SQL 不能为空");
        }
        String lower = sql.toLowerCase().trim();
        for (String kw : FORBIDDEN_KEYWORDS) {
            if (lower.contains(kw)) {
                throw new DataException(ErrorCode.INVALID_FIELD_VALUE,
                        "只读 SQL 不允许包含关键词: " + kw);
            }
        }
        if (!lower.startsWith("select") && !lower.startsWith("with") && !lower.startsWith("show")) {
            throw new DataException(ErrorCode.INVALID_FIELD_VALUE,
                    "只读 SQL 必须以 SELECT / WITH / SHOW 开头");
        }
    }

    private void recordHistory(String datasourceId, String sql, int rowCount, long latency, String status) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        ConcurrentLinkedDeque<QueryHistoryResponse> deque =
                historyStore.computeIfAbsent(tenantId, k -> new ConcurrentLinkedDeque<>());
        QueryHistoryResponse record = QueryHistoryResponse.builder()
                .queryId("q-" + UUID.randomUUID().toString().replace("-", ""))
                .datasourceId(datasourceId)
                .sql(sql)
                .rowCount(rowCount)
                .latencyMs(latency)
                .status(status)
                .executedBy(TenantContext.getUserId() != null ? TenantContext.getUserId() : "system")
                .executedAt(OffsetDateTime.now())
                .build();
        deque.offerFirst(record);
        while (deque.size() > HISTORY_MAX_SIZE) {
            deque.pollLast();
        }
    }
}
