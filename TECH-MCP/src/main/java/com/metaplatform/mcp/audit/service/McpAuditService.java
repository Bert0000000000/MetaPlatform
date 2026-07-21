package com.metaplatform.mcp.audit.service;

import com.metaplatform.mcp.audit.dto.AnalyticsItem;
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
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
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
    public PageResponse<AuditLogResponse> query(UUID toolId, UUID serverId, UUID clientId,
                                                String status, Instant startTime, Instant endTime,
                                                Integer page, Integer size) {
        String tenantId = TenantContext.getOrDefault();
        int p = page == null || page < 1 ? 1 : page;
        int s = size == null || size < 1 ? 20 : Math.min(size, 100);
        Pageable pageable = PageRequest.of(p - 1, s, Sort.by(Sort.Direction.DESC, "calledAt"));

        Page<McpAuditLogEntity> result = repository.search(
                tenantId, toolId, serverId, clientId,
                status == null ? null : status.toUpperCase(),
                startTime, endTime, pageable);

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
        long successCount = 0;
        long failureCount = 0;
        for (Object[] row : repository.countByStatus(tenantId, startTime, endTime)) {
            String status = String.valueOf(row[0]);
            long count = ((Number) row[1]).longValue();
            byStatus.put(status, count);
            if (STATUS_SUCCESS.equalsIgnoreCase(status)) {
                successCount = count;
            } else {
                failureCount += count;
            }
        }

        Map<String, Long> byTool = new LinkedHashMap<>();
        for (Object[] row : repository.countByTool(tenantId, startTime, endTime)) {
            byTool.put(String.valueOf(row[0]), ((Number) row[1]).longValue());
        }

        long total = byStatus.values().stream().mapToLong(Long::longValue).sum();
        double successRate = total == 0 ? 0.0 : ((double) successCount) / total;

        Object[] agg = repository.aggregate(tenantId, startTime, endTime);
        long inputTokens = agg[0] == null ? 0L : ((Number) agg[0]).longValue();
        long outputTokens = agg[1] == null ? 0L : ((Number) agg[1]).longValue();
        double avgDuration = agg[2] == null ? 0.0 : ((Number) agg[2]).doubleValue();

        return AuditLogStatistics.builder()
                .totalCalls(total)
                .successCount(successCount)
                .failureCount(failureCount)
                .successRate(successRate)
                .avgDuration(avgDuration)
                .totalInputTokens(inputTokens)
                .totalOutputTokens(outputTokens)
                .totalTokens(inputTokens + outputTokens)
                .byStatus(byStatus)
                .byTool(byTool)
                .build();
    }

    @Transactional(readOnly = true)
    public List<TrendPoint> trends(String interval, UUID toolId, UUID serverId, UUID clientId,
                                   String status, Instant startTime, Instant endTime) {
        String tenantId = TenantContext.getOrDefault();
        String effectiveInterval = "day".equalsIgnoreCase(interval) ? "day" : "hour";
        List<Object[]> rows = repository.trendDetailed(
                tenantId, effectiveInterval,
                status == null ? null : status.toUpperCase(),
                toolId, serverId, clientId, startTime, endTime);
        return rows.stream().map(this::toTrendPoint).toList();
    }

    @Transactional(readOnly = true)
    public List<AnalyticsItem> analytics(String dimension, UUID toolId, UUID serverId, UUID clientId,
                                         String status, Instant startTime, Instant endTime) {
        String tenantId = TenantContext.getOrDefault();
        String dim = dimension == null ? "tool" : dimension.toLowerCase();
        String effectiveStatus = status == null ? null : status.toUpperCase();
        List<Object[]> rows = switch (dim) {
            case "server" -> repository.analyticsByServer(
                    tenantId, effectiveStatus, toolId, serverId, clientId, startTime, endTime);
            case "app", "client" -> repository.analyticsByClient(
                    tenantId, effectiveStatus, toolId, serverId, clientId, startTime, endTime);
            default -> repository.analyticsByTool(
                    tenantId, effectiveStatus, toolId, serverId, clientId, startTime, endTime);
        };
        return rows.stream().map(r -> {
            String key = r[0] == null ? "未知" : String.valueOf(r[0]);
            long count = ((Number) r[1]).longValue();
            long errors = ((Number) r[2]).longValue();
            long tokens = ((Number) r[3]).longValue();
            double avg = ((Number) r[4]).doubleValue();
            return AnalyticsItem.builder()
                    .dimension(dim)
                    .dimensionKey(key)
                    .count(count)
                    .errorCount(errors)
                    .tokenCount(tokens)
                    .avgDuration(avg)
                    .build();
        }).toList();
    }

    @Transactional(readOnly = true)
    public List<AuditLogResponse> trace(UUID id) {
        String tenantId = TenantContext.getOrDefault();
        McpAuditLogEntity root = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new McpException(ErrorCode.AUDIT_LOG_NOT_FOUND, "审计日志不存在"));
        if (root.getTraceId() == null) {
            return List.of(toResponse(root));
        }
        return repository.findByTraceIdAndTenantId(tenantId, root.getTraceId())
                .stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public byte[] export(UUID toolId, UUID serverId, UUID clientId,
                         String status, Instant startTime, Instant endTime, String format) {
        String tenantId = TenantContext.getOrDefault();
        List<McpAuditLogEntity> all = repository.findAllForExport(
                tenantId, toolId, serverId, clientId,
                status == null ? null : status.toUpperCase(),
                startTime, endTime,
                PageRequest.of(0, EXPORT_LIMIT));

        if ("xlsx".equalsIgnoreCase(format)) {
            return exportXlsx(all);
        }
        return exportCsv(all);
    }

    private byte[] exportCsv(List<McpAuditLogEntity> all) {
        StringBuilder sb = new StringBuilder();
        sb.append("id,tool_code,server_id,client_id,status,invocation_type,duration_ms,input_tokens,output_tokens,called_at,error_message\n");
        for (McpAuditLogEntity e : all) {
            sb.append(e.getId()).append(',')
                    .append(csv(e.getToolCode())).append(',')
                    .append(csv(e.getServerId() == null ? null : e.getServerId().toString())).append(',')
                    .append(csv(e.getClientId() == null ? null : e.getClientId().toString())).append(',')
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

    private byte[] exportXlsx(List<McpAuditLogEntity> all) {
        try (Workbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = wb.createSheet("audit");
            Row header = sheet.createRow(0);
            String[] columns = {"id", "tool_code", "server_id", "client_id", "status", "invocation_type",
                    "duration_ms", "input_tokens", "output_tokens", "called_at", "error_message"};
            for (int i = 0; i < columns.length; i++) {
                header.createCell(i).setCellValue(columns[i]);
            }
            for (int i = 0; i < all.size(); i++) {
                McpAuditLogEntity e = all.get(i);
                Row row = sheet.createRow(i + 1);
                row.createCell(0).setCellValue(e.getId() == null ? "" : e.getId().toString());
                row.createCell(1).setCellValue(e.getToolCode());
                row.createCell(2).setCellValue(e.getServerId() == null ? "" : e.getServerId().toString());
                row.createCell(3).setCellValue(e.getClientId() == null ? "" : e.getClientId().toString());
                row.createCell(4).setCellValue(e.getStatus());
                row.createCell(5).setCellValue(e.getInvocationType());
                row.createCell(6).setCellValue(e.getDurationMs() == null ? 0 : e.getDurationMs());
                row.createCell(7).setCellValue(e.getInputTokens() == null ? 0 : e.getInputTokens());
                row.createCell(8).setCellValue(e.getOutputTokens() == null ? 0 : e.getOutputTokens());
                row.createCell(9).setCellValue(e.getCalledAt() == null ? "" : e.getCalledAt().toString());
                row.createCell(10).setCellValue(e.getErrorMessage());
            }
            wb.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new McpException(ErrorCode.INTERNAL_ERROR, "导出 Excel 失败: " + e.getMessage());
        }
    }

    private TrendPoint toTrendPoint(Object[] r) {
        Instant time = r[0] instanceof java.sql.Timestamp ts ? ts.toInstant()
                : r[0] instanceof Instant i ? i : Instant.now();
        long count = ((Number) r[1]).longValue();
        long errors = ((Number) r[2]).longValue();
        long tokens = ((Number) r[3]).longValue();
        double avg = ((Number) r[4]).doubleValue();
        return TrendPoint.builder()
                .time(time)
                .count(count)
                .errorCount(errors)
                .tokenCount(tokens)
                .avgDuration(avg)
                .build();
    }

    private AuditLogResponse toResponse(McpAuditLogEntity entity) {
        return AuditLogResponse.builder()
                .id(entity.getId())
                .toolId(entity.getToolId())
                .toolCode(entity.getToolCode())
                .serverId(entity.getServerId())
                .clientId(entity.getClientId())
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
}
