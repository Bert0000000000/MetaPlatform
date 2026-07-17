package com.metaplatform.gw.audit.controller;

import com.metaplatform.gw.audit.dto.AuditLogResponse;
import com.metaplatform.gw.audit.dto.AuditLogStatistics;
import com.metaplatform.gw.audit.dto.RecordAuditLogRequest;
import com.metaplatform.gw.audit.service.AuditLogExportService;
import com.metaplatform.gw.audit.service.AuditLogService;
import com.metaplatform.gw.common.ApiResponseBody;
import com.metaplatform.gw.common.PageResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/v1/gw/audit-logs")
@RequiredArgsConstructor
@Slf4j
public class AuditLogController {

    private final AuditLogService auditLogService;
    private final AuditLogExportService exportService;

    @PostMapping
    public Mono<ApiResponseBody<AuditLogResponse>> record(@RequestBody RecordAuditLogRequest request) {
        return auditLogService.record(request).map(ApiResponseBody::success);
    }

    @GetMapping
    public Mono<ApiResponseBody<PageResponse<AuditLogResponse>>> query(
            @RequestParam(required = false) String tenantId,
            @RequestParam(required = false) String path,
            @RequestParam(required = false) String method,
            @RequestParam(required = false) Integer statusCode,
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String traceId,
            @RequestParam(required = false) Boolean isError,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        return auditLogService.query(tenantId, path, method, statusCode, userId, traceId, isError, page, size)
                .map(ApiResponseBody::success);
    }

    @GetMapping("/statistics")
    public Mono<ApiResponseBody<AuditLogStatistics>> statistics(
            @RequestParam(required = false) String tenantId,
            @RequestParam(required = false) String startTime,
            @RequestParam(required = false) String endTime) {
        return auditLogService.getStatistics(tenantId, parseTime(startTime), parseTime(endTime))
                .map(ApiResponseBody::success);
    }

    @GetMapping("/slow-requests")
    public Mono<ApiResponseBody<List<AuditLogResponse>>> slowRequests(
            @RequestParam(defaultValue = "1000") long threshold,
            @RequestParam(required = false) String tenantId,
            @RequestParam(defaultValue = "100") int limit) {
        return auditLogService.findSlowRequests(threshold, tenantId, limit)
                .map(ApiResponseBody::success);
    }

    @GetMapping("/trace/{traceId}")
    public Mono<ApiResponseBody<List<AuditLogResponse>>> byTrace(@PathVariable String traceId) {
        return auditLogService.findByTraceId(traceId).map(ApiResponseBody::success);
    }

    @GetMapping("/export")
    public Mono<ResponseEntity<String>> export(
            @RequestParam(defaultValue = "csv") String format,
            @RequestParam(required = false) String tenantId,
            @RequestParam(required = false) String startTime,
            @RequestParam(required = false) String endTime) {
        return Mono.fromCallable(() -> {
                    List<AuditLogResponse> logs = auditLogService
                            .exportRange(tenantId, parseTime(startTime), parseTime(endTime))
                            .block();
                    return exportService.render(format, logs);
                })
                .map(doc -> ResponseEntity.ok()
                        .contentType(MediaType.parseMediaType(doc.getContentType()))
                        .body(doc.getContent()));
    }

    private LocalDateTime parseTime(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return LocalDateTime.parse(value);
        } catch (Exception ex) {
            return null;
        }
    }
}
