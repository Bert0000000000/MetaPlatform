package com.metaplatform.iam.audit.controller;

import com.metaplatform.iam.audit.dto.AuditLogResponse;
import com.metaplatform.iam.audit.dto.AuditLogStatisticsResponse;
import com.metaplatform.iam.audit.service.AuditLogService;
import com.metaplatform.iam.common.ApiResponse;
import com.metaplatform.iam.common.PageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

@RestController
@RequestMapping("/api/v1/iam/audit-logs")
@RequiredArgsConstructor
public class AuditLogController {

    private final AuditLogService auditLogService;

    @GetMapping
    public ApiResponse<PageResponse<AuditLogResponse>> query(
            @RequestParam(required = false) String tenantId,
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String resourceType,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Instant startTime,
            @RequestParam(required = false) Instant endTime,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return ApiResponse.success(auditLogService.query(tenantId, userId, action, resourceType,
                status, startTime, endTime, page, size));
    }

    @GetMapping("/statistics")
    public ApiResponse<AuditLogStatisticsResponse> statistics(
            @RequestParam(required = false) String tenantId,
            @RequestParam(required = false) Instant startTime,
            @RequestParam(required = false) Instant endTime) {
        return ApiResponse.success(auditLogService.statistics(tenantId, startTime, endTime));
    }

    @GetMapping("/export")
    public ResponseEntity<byte[]> export(
            @RequestParam(required = false) String tenantId,
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String resourceType,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Instant startTime,
            @RequestParam(required = false) Instant endTime,
            @RequestParam(defaultValue = "csv") String format) {
        byte[] data = auditLogService.export(tenantId, userId, action, resourceType, status,
                startTime, endTime, format);
        MediaType mediaType = "json".equalsIgnoreCase(format)
                ? MediaType.APPLICATION_JSON : MediaType.valueOf("text/csv");
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(mediaType);
        headers.set(HttpHeaders.CONTENT_DISPOSITION,
                "attachment; filename=audit-logs." + ("json".equalsIgnoreCase(format) ? "json" : "csv"));
        return ResponseEntity.ok().headers(headers).body(data);
    }

    @GetMapping("/{id}")
    public ApiResponse<AuditLogResponse> get(@PathVariable String id) {
        return ApiResponse.success(auditLogService.get(id));
    }
}
