package com.metaplatform.mcp.overview.service;

import com.metaplatform.mcp.audit.entity.McpAuditLogEntity;
import com.metaplatform.mcp.audit.repository.McpAuditLogRepository;
import com.metaplatform.mcp.common.TenantContext;
import com.metaplatform.mcp.overview.dto.OverviewResponse;
import com.metaplatform.mcp.overview.dto.OverviewResponse.CallStats;
import com.metaplatform.mcp.overview.dto.OverviewResponse.ErrorAlert;
import com.metaplatform.mcp.overview.dto.OverviewResponse.ServerStats;
import com.metaplatform.mcp.overview.dto.OverviewResponse.ToolStats;
import com.metaplatform.mcp.overview.dto.OverviewResponse.TokenStats;
import com.metaplatform.mcp.overview.dto.OverviewResponse.TopTool;
import com.metaplatform.mcp.overview.dto.OverviewResponse.TrendPoint;
import com.metaplatform.mcp.server.repository.McpServerRepository;
import com.metaplatform.mcp.tool.repository.McpToolRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

/**
 * MCP Hub 概览页聚合服务。
 *
 * <p>整合 Server/Tool/Audit 三层数据，输出概览页所需的全部统计与告警信息。</p>
 */
@Service
@RequiredArgsConstructor
public class McpOverviewService {

    private static final String STATUS_SUCCESS = "SUCCESS";
    private static final String STATUS_TIMEOUT = "TIMEOUT";
    private static final String LEVEL_ERROR = "error";
    private static final String LEVEL_WARNING = "warning";
    private static final int MAX_ERROR_ALERTS = 20;
    private static final int MAX_TOP_TOOLS = 10;
    private static final DateTimeFormatter ISO_FORMATTER = DateTimeFormatter.ISO_INSTANT;

    private final McpServerRepository mcpServerRepository;
    private final McpToolRepository mcpToolRepository;
    private final McpAuditLogRepository auditLogRepository;

    @Transactional(readOnly = true)
    public OverviewResponse overview() {
        String tenantId = TenantContext.getOrDefault();
        Instant todayStart = LocalDate.now(ZoneId.systemDefault())
                .atStartOfDay(ZoneId.systemDefault())
                .toInstant();

        ServerStats serverStats = buildServerStats(tenantId);
        ToolStats toolStats = buildToolStats(tenantId);
        CallStats callStats = buildCallStats(tenantId, todayStart);
        TokenStats tokenStats = buildTokenStats(tenantId, todayStart);
        List<ErrorAlert> errorAlerts = buildErrorAlerts(tenantId, todayStart);
        List<TopTool> topTools = buildTopTools(tenantId, todayStart);
        List<TrendPoint> callTrend = buildTrend(tenantId, todayStart, true);
        List<TrendPoint> tokenTrend = buildTrend(tenantId, todayStart, false);

        return OverviewResponse.builder()
                .serverStats(serverStats)
                .toolStats(toolStats)
                .callStats(callStats)
                .tokenStats(tokenStats)
                .errorAlerts(errorAlerts)
                .topTools(topTools)
                .callTrend(callTrend)
                .tokenTrend(tokenTrend)
                .build();
    }

    private ServerStats buildServerStats(String tenantId) {
        long online = 0;
        long offline = 0;
        long error = 0;
        long total = 0;
        for (Object[] row : mcpServerRepository.countByStatus(tenantId)) {
            String status = String.valueOf(row[0]);
            long count = ((Number) row[1]).longValue();
            total += count;
            if ("ACTIVE".equalsIgnoreCase(status)) {
                online += count;
            } else if ("INACTIVE".equalsIgnoreCase(status)) {
                offline += count;
            } else if ("ERROR".equalsIgnoreCase(status)) {
                error += count;
            }
        }
        return ServerStats.builder()
                .total(total)
                .online(online)
                .offline(offline)
                .error(error)
                .build();
    }

    private ToolStats buildToolStats(String tenantId) {
        long total = mcpToolRepository.countByTenantIdAndDeletedAtIsNull(tenantId);
        long enabled = mcpToolRepository.countByTenantIdAndEnabledTrueAndDeletedAtIsNull(tenantId);
        long disabled = mcpToolRepository.countByTenantIdAndEnabledFalseAndDeletedAtIsNull(tenantId);
        return ToolStats.builder()
                .total(total)
                .enabled(enabled)
                .disabled(disabled)
                .build();
    }

    private CallStats buildCallStats(String tenantId, Instant todayStart) {
        Object[] agg = auditLogRepository.aggregate(tenantId, todayStart, Instant.now());
        double avgDuration = agg[2] == null ? 0.0 : ((Number) agg[2]).doubleValue();

        long todayCalls = 0;
        long successCount = 0;
        for (Object[] row : auditLogRepository.countByStatus(tenantId, todayStart, Instant.now())) {
            String status = String.valueOf(row[0]);
            long count = ((Number) row[1]).longValue();
            todayCalls += count;
            if (STATUS_SUCCESS.equalsIgnoreCase(status)) {
                successCount = count;
            }
        }
        double successRate = todayCalls == 0 ? 0.0 : ((double) successCount) / todayCalls;
        return CallStats.builder()
                .todayCalls(todayCalls)
                .successRate(successRate)
                .avgDuration(avgDuration)
                .build();
    }

    private TokenStats buildTokenStats(String tenantId, Instant todayStart) {
        Object[] agg = auditLogRepository.aggregate(tenantId, todayStart, Instant.now());
        long inputTokens = agg[0] == null ? 0L : ((Number) agg[0]).longValue();
        long outputTokens = agg[1] == null ? 0L : ((Number) agg[1]).longValue();
        return TokenStats.builder()
                .todayInputTokens(inputTokens)
                .todayOutputTokens(outputTokens)
                .todayTotalTokens(inputTokens + outputTokens)
                .build();
    }

    private List<ErrorAlert> buildErrorAlerts(String tenantId, Instant todayStart) {
        List<McpAuditLogEntity> errors = auditLogRepository.findRecentErrors(
                tenantId, todayStart, PageRequest.of(0, MAX_ERROR_ALERTS));
        List<ErrorAlert> alerts = new ArrayList<>();
        for (McpAuditLogEntity e : errors) {
            String level = STATUS_TIMEOUT.equalsIgnoreCase(e.getStatus())
                    ? LEVEL_WARNING : LEVEL_ERROR;
            alerts.add(ErrorAlert.builder()
                    .id(e.getId() == null ? null : e.getId().toString())
                    .toolCode(e.getToolCode())
                    .status(e.getStatus())
                    .level(level)
                    .errorMessage(e.getErrorMessage())
                    .calledAt(e.getCalledAt() == null ? null : ISO_FORMATTER.format(e.getCalledAt()))
                    .traceId(e.getTraceId())
                    .build());
        }
        return alerts;
    }

    private List<TopTool> buildTopTools(String tenantId, Instant todayStart) {
        List<Object[]> rows = auditLogRepository.countByTool(tenantId, todayStart, Instant.now());
        List<TopTool> tools = new ArrayList<>();
        int limit = Math.min(rows.size(), MAX_TOP_TOOLS);
        for (int i = 0; i < limit; i++) {
            Object[] row = rows.get(i);
            String toolCode = row[0] == null ? "" : String.valueOf(row[0]);
            long count = row[1] == null ? 0L : ((Number) row[1]).longValue();
            tools.add(TopTool.builder().toolCode(toolCode).count(count).build());
        }
        return tools;
    }

    private List<TrendPoint> buildTrend(String tenantId, Instant todayStart, boolean callsOnly) {
        List<Object[]> rows = auditLogRepository.trendWithTokensByInterval(
                tenantId, "hour", todayStart, Instant.now());
        List<TrendPoint> points = new ArrayList<>();
        for (Object[] row : rows) {
            Instant time = row[0] instanceof java.sql.Timestamp ts ? ts.toInstant()
                    : row[0] instanceof Instant i ? i : Instant.now();
            long count = row[1] == null ? 0L : ((Number) row[1]).longValue();
            long tokens = callsOnly ? 0L : (row[2] == null ? 0L : ((Number) row[2]).longValue());
            points.add(TrendPoint.builder()
                    .time(ISO_FORMATTER.format(time))
                    .count(count)
                    .tokens(tokens)
                    .build());
        }
        return points;
    }
}
