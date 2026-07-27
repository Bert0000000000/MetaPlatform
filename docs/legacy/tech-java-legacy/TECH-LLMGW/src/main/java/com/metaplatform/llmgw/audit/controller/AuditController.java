package com.metaplatform.llmgw.audit.controller;

import com.metaplatform.llmgw.audit.dto.AuditLogDto;
import com.metaplatform.llmgw.audit.dto.AuditQueryRequest;
import com.metaplatform.llmgw.audit.dto.AuditStatisticsDto;
import com.metaplatform.llmgw.audit.service.AuditService;
import com.metaplatform.llmgw.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/v1/llmgw/audit")
@RequiredArgsConstructor
public class AuditController {

    private final AuditService auditService;

    @GetMapping
    public ApiResponse<Page<AuditLogDto>> list(Pageable pageable) {
        return ApiResponse.ok(auditService.list(pageable));
    }

    @GetMapping("/{id}")
    public ApiResponse<AuditLogDto> getById(@PathVariable Long id) {
        return ApiResponse.ok(auditService.getById(id));
    }

    @GetMapping("/stats")
    public ApiResponse<AuditStatisticsDto> stats(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime start,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime end) {
        return ApiResponse.ok(auditService.getStatistics(start, end));
    }

    @PostMapping("/export")
    public ApiResponse<List<AuditLogDto>> export(@RequestBody AuditQueryRequest request) {
        Page<AuditLogDto> page = auditService.query(request);
        return ApiResponse.ok(page.getContent());
    }

    @GetMapping("/query")
    public ApiResponse<Page<AuditLogDto>> query(@ModelAttribute AuditQueryRequest request) {
        return ApiResponse.ok(auditService.query(request));
    }
}
