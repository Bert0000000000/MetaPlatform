package com.metaplatform.mcp.audit.service;

import com.metaplatform.mcp.audit.dto.AuditLogResponse;
import com.metaplatform.mcp.audit.dto.AuditLogStatistics;
import com.metaplatform.mcp.audit.dto.TrendPoint;
import com.metaplatform.mcp.audit.entity.McpAuditLogEntity;
import com.metaplatform.mcp.audit.repository.McpAuditLogRepository;
import com.metaplatform.mcp.common.ErrorCode;
import com.metaplatform.mcp.common.PageResponse;
import com.metaplatform.mcp.common.TenantContext;
import com.metaplatform.mcp.exception.McpException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class McpAuditService {

    private static final String STATUS_SUCCESS = "SUCCESS";
    private static final int EXPORT_LIMIT = 10_000;

    private final McpAuditLogRepository repository;

    @Transactional
    public AuditLogResponse record(McpAuditLogEntity entity) {
        if (entity.getTenantId() == null) {
            entity.setTenantId(TenantContext.getOrDefault());
        }
        if (entity.getCalledAt() == null) {
            entity.setCalledAt(Instant.now());
        }
        if (entity.getInputTokens() == null) {
            entity.setInputTokens(0);
        }
        if (entity.getOutputTokens() == null) {
            entity.setOutputTokens(0);
        }
        return toResponse(repository.save(entity));
    }

    @Transactional(readOnly = true)
    public PageResponse<AuditLogResponse> query(UUID toolId, String status,
                                                Instant startTime, Instant endTime,
                                                Integer page, Integer size) {
        String tenantId = TenantContext.getOrDefault();
        int p = page == null || page < 1 ? 1 : page;
        int s = size == null || size < 1 ? 20 : Math.min(size, 100);
        Pageable pageable = PageRequest.of(p - 1, s, Sort.by(Sort.Direction.DESC, "calledAt"));

        Page<McpAuditLogEntity> result = repository.search(
                tenantId,
                toolId,
                status == null ? null : status.toUpperCase(),
                startTime, endTime,
                pageable);

        List<AuditLogResponse> items = result.getContent().stream().map(this::toResponse).toList();
        return PageResponse.<AuditLogResponse>builder()
                .items(items)
                .total(result.getTotalElements())
                .page(p)
                .size(s)
                .totalPages(result.getTotalPages())
                .build();
    }

    @Transactional(readOnly = true)
    public AuditLogResponse get(UUID id) {
        return toResponse(repository.findById(id)
                .orElseThrow(() -> new McpException(ErrorCode.AUDIT_LOG_NOT_FOUND, "审计日志不存在")));
    }

    @Transactional(readOnly = true)
    public AuditLogStatistics statistics(Instant startTime, Instant endTime) {
        String tenantId = TenantContext.getOrDefault();
        Map<String, Long> byStatus = new LinkedHashMap<>();
        for (Object[] row : repository.countByStatus(tenantId, startTime, endTime)) {
            byStatus.put(String.valueOf(row[0]), ((Number) row[1]).longValue());
        }
        Map<String, Long> byTool = new LinkedHashMap<>();
        for (Object[] row : repository.countByTool(tenantId, startTime, endTime)) {
            byTool.put(String.valueOf(row[0]), ((Number) row[1]).longValue());
        }

        long total = byStatus.values().stream().mapToLong(Long::longValue).sum();
        long successCount = byStatus.getOrDefault(STATUS_SUCCESS, 0L);
        double successRate = total == 0 ? 0.0 : ((double) successCount) / total;

        Object[] agg = repository.aggregate(tenantId, startTime, endTime);
        long inputTokens = agg[0] == null ? 0L : ((Number) agg[0]).longValue();
        long outputTokens = agg[1] == null ? 0L : ((Number) agg[1]).longValue();
        double avgDuration = agg[2] == null ? 0.0 : ((Number) agg[2]).doubleValue();

        return AuditLogStatistics.builder()
                .totalCalls(total)
                .successRate(successRate)
                .avgDuration(avgDuration)
                .totalInputTokens(inputTokens)
                .totalOutputTokens(outputTokens)
                .byStatus(byStatus)
                .byTool(byTool)
                .build();
    }

    @Transactional(readOnly = true)
    public List<TrendPoint> trends(String interval, Instant startTime, Instant endTime) {
        String tenantId = TenantContext.getOrDefault();
        String effectiveInterval = "day".equalsIgnoreCase(interval) ? "day" : "hour";
        List<Object[]> rows = repository.trendByInterval(tenantId, effectiveInterval, startTime, endTime);
        return rows.stream().map(r -> {
            Instant time = r[0] instanceof java.sql.Timestamp ts ? ts.toInstant()
                    : r[0] instanceof Instant i ? i : Instant.now();
            long count = ((Number) r[1]).longValue();
            return TrendPoint.builder().time(time).count(count).build();
        }).toList();
    }

    @Transactional(readOnly = true)
    public byte[] export(UUID toolId, String status, Instant startTime, Instant endTime, String format) {
        String tenantId = TenantContext.getOrDefault();
        List<McpAuditLogEntity> all = repository.findAllForExport(
                tenantId, toolId,
                status == null ? null : status.toUpperCase(),
                startTime, endTime,
                PageRequest.of(0, EXPORT_LIMIT));

        boolean asJson = "json".equalsIgnoreCase(format);
        if (asJson) {
            StringBuilder sb = new StringBuilder("[");
            for (int i = 0; i < all.size(); i++) {
                if (i > 0) sb.append(',');
                McpAuditLogEntity e = all.get(i);
                sb.append('{')
                        .append("\"id\":\"").append(e.getId()).append("\",")
                        .append("\"toolCode\":").append(json(e.getToolCode())).append(',')
                        .append("\"status\":").append(json(e.getStatus())).append(',')
                        .append("\"durationMs\":").append(e.getDurationMs()).append(',')
                        .append("\"inputTokens\":").append(e.getInputTokens()).append(',')
                        .append("\"outputTokens\":").append(e.getOutputTokens()).append(',')
                        .append("\"calledAt\":").append(json(e.getCalledAt() == null ? null : e.getCalledAt().toString()))
                        .append('}');
            }
            sb.append(']');
            return sb.toString().getBytes();
        }
        StringBuilder sb = new StringBuilder();
        sb.append("id,tool_code,status,invocation_type,duration_ms,input_tokens,output_tokens,called_at,error_message\n");
        for (McpAuditLogEntity e : all) {
            sb.append(e.getId()).append(',')
                    .append(csv(e.getToolCode())).append(',')
                    .append(csv(e.getStatus())).append(',')
                    .append(csv(e.getInvocationType())).append(',')
                    .append(e.getDurationMs()).append(',')
                    .append(e.getInputTokens()).append(',')
                    .append(e.getOutputTokens()).append(',')
                    .append(csv(e.getCalledAt() == null ? null : e.getCalledAt().toString())).append(',')
                    .append(csv(e.getErrorMessage())).append('\n');
        }
        return sb.toString().getBytes();
    }

    private AuditLogResponse toResponse(McpAuditLogEntity entity) {
        return AuditLogResponse.builder()
                .id(entity.getId())
                .toolId(entity.getToolId())
                .toolCode(entity.getToolCode())
                .invocationType(entity.getInvocationType())
                .inputTokens(entity.getInputTokens())
                .outputTokens(entity.getOutputTokens())
                .durationMs(entity.getDurationMs())
                .status(entity.getStatus())
                .errorMessage(entity.getErrorMessage())
                .traceId(entity.getTraceId())
                .userId(entity.getUserId())
                .calledAt(entity.getCalledAt())
                .build();
    }

    private String csv(String value) {
        if (value == null) return "";
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }

    private String json(String value) {
        if (value == null) return "null";
        return "\"" + value.replace("\"", "\\\"") + "\"";
    }
}