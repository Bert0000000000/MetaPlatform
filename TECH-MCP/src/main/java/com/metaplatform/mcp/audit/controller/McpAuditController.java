package com.metaplatform.mcp.audit.controller;

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
@RequestMapping("/api/v1/mcp/audit-logs")
@RequiredArgsConstructor
public class McpAuditController {

    private final McpAuditService auditService;

    @GetMapping
    public ApiResponse<PageResponse<AuditLogResponse>> list(
            @RequestParam(required = false) UUID toolId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Instant startTime,
            @RequestParam(required = false) Instant endTime,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return ApiResponse.success(auditService.query(toolId, status, startTime, endTime, page, size));
    }

    @GetMapping("/{id}")
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
            @RequestParam(required = false, defaultValue = "hour") String interval,
            @RequestParam(required = false) Instant startTime,
            @RequestParam(required = false) Instant endTime) {
        return ApiResponse.success(auditService.trends(interval, startTime, endTime));
    }

    @GetMapping("/export")
    public ResponseEntity<byte[]> export(
            @RequestParam(required = false) UUID toolId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Instant startTime,
            @RequestParam(required = false) Instant endTime,
            @RequestParam(required = false, defaultValue = "csv") String format) {
        byte[] bytes = auditService.export(toolId, status, startTime, endTime, format);
        String filename = "mcp-audit-" + System.currentTimeMillis() + "." + format;
        String contentType = "json".equalsIgnoreCase(format)
                ? MediaType.APPLICATION_JSON_VALUE
                : "text/csv";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType(contentType))
                .body(bytes);
    }
}