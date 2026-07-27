package com.metaplatform.mcp.audit.controller;

import com.metaplatform.mcp.audit.dto.AnalyticsItem;
import com.metaplatform.mcp.audit.dto.AuditLogResponse;
import com.metaplatform.mcp.audit.dto.AuditLogStatistics;
import com.metaplatform.mcp.audit.dto.TrendPoint;
import com.metaplatform.mcp.audit.service.McpAuditService;
import com.metaplatform.mcp.common.ApiResponse;
import com.metaplatform.mcp.common.PageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/mcp/audit")
@RequiredArgsConstructor
public class McpAuditController {

    private final McpAuditService auditService;

    @GetMapping("/logs")
    public ApiResponse<PageResponse<AuditLogResponse>> list(
            @RequestParam(required = false) UUID toolId,
            @RequestParam(required = false) UUID serverId,
            @RequestParam(required = false) UUID clientId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Instant startTime,
            @RequestParam(required = false) Instant endTime,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return ApiResponse.success(auditService.query(toolId, serverId, clientId, status, startTime, endTime, page, size));
    }

    @GetMapping("/logs/{id}")
    public ApiResponse<AuditLogResponse> get(@PathVariable UUID id) {
        return ApiResponse.success(auditService.get(id));
    }

    @GetMapping("/statistics")
    public ApiResponse<AuditLogStatistics> statistics(
            @RequestParam(required = false) Instant startTime,
            @RequestParam(required = false) Instant endTime) {
        return ApiResponse.success(auditService.statistics(startTime, endTime));
    }

    @GetMapping("/trends")
    public ApiResponse<List<TrendPoint>> trends(
            @RequestParam(required = false, defaultValue = "hour") String granularity,
            @RequestParam(required = false) UUID toolId,
            @RequestParam(required = false) UUID serverId,
            @RequestParam(required = false) UUID clientId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Instant startTime,
            @RequestParam(required = false) Instant endTime) {
        return ApiResponse.success(auditService.trends(granularity, toolId, serverId, clientId, status, startTime, endTime));
    }

    @GetMapping("/analytics")
    public ApiResponse<List<AnalyticsItem>> analytics(
            @RequestParam(required = false, defaultValue = "tool") String dimension,
            @RequestParam(required = false) UUID toolId,
            @RequestParam(required = false) UUID serverId,
            @RequestParam(required = false) UUID clientId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Instant startTime,
            @RequestParam(required = false) Instant endTime) {
        return ApiResponse.success(auditService.analytics(dimension, toolId, serverId, clientId, status, startTime, endTime));
    }

    @GetMapping("/{id}/trace")
    public ApiResponse<List<AuditLogResponse>> trace(@PathVariable UUID id) {
        return ApiResponse.success(auditService.trace(id));
    }

    @GetMapping("/export")
    public ResponseEntity<byte[]> export(
            @RequestParam(required = false) UUID toolId,
            @RequestParam(required = false) UUID serverId,
            @RequestParam(required = false) UUID clientId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Instant startTime,
            @RequestParam(required = false) Instant endTime,
            @RequestParam(required = false, defaultValue = "csv") String format) {
        byte[] bytes = auditService.export(toolId, serverId, clientId, status, startTime, endTime, format);
        String extension = "xlsx".equalsIgnoreCase(format) ? "xlsx" : "csv";
        String filename = "mcp-audit-" + System.currentTimeMillis() + "." + extension;
        String contentType = "xlsx".equalsIgnoreCase(format)
                ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                : "text/csv";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType(contentType))
                .body(bytes);
    }
}
