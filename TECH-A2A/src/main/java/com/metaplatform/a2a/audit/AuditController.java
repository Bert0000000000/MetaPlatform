package com.metaplatform.a2a.audit;

import com.metaplatform.a2a.common.ApiResponse;
import com.metaplatform.a2a.common.PageResponse;
import com.metaplatform.a2a.common.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * 审计日志端点。
 *
 * <p>对应 Python {@code app.api.v1.audit}。</p>
 */
@RestController
@RequestMapping("/api/v1/a2a/audit")
@RequiredArgsConstructor
public class AuditController {

    private final AuditService auditService;

    /**
     * 审计记录列表（分页 + 过滤）。
     */
    @GetMapping
    public ApiResponse<PageResponse<Map<String, Object>>> list(
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String actorId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        PageResponse<Map<String, Object>> result = auditService.list(
                TenantContext.getTenantIdOrDefault(), action, actorId, page, pageSize);
        return ApiResponse.success(result);
    }

    /**
     * 协作统计。
     */
    @GetMapping("/stats/collaboration")
    public ApiResponse<Map<String, Object>> collaborationStats(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime start,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime end) {
        return ApiResponse.success(auditService.collaborationStats(
                TenantContext.getTenantIdOrDefault(), start, end));
    }

    /**
     * 委派统计。
     */
    @GetMapping("/stats/delegation")
    public ApiResponse<Map<String, Object>> delegationStats(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime start,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime end) {
        return ApiResponse.success(auditService.delegationStats(
                TenantContext.getTenantIdOrDefault(), start, end));
    }

    /**
     * 错误统计。
     */
    @GetMapping("/stats/errors")
    public ApiResponse<Map<String, Object>> errorStats(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime start,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime end) {
        return ApiResponse.success(auditService.errorStats(
                TenantContext.getTenantIdOrDefault(), start, end));
    }

    /**
     * 按 Agent 统计。
     */
    @GetMapping("/stats/agents/{agentId}")
    public ApiResponse<Map<String, Object>> agentStats(
            @org.springframework.web.bind.annotation.PathVariable String agentId) {
        return ApiResponse.success(auditService.agentStats(
                TenantContext.getTenantIdOrDefault(), agentId));
    }

    /**
     * 导出审计记录。
     */
    @GetMapping("/export")
    public ApiResponse<List<Map<String, Object>>> export(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime start,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime end) {
        return ApiResponse.success(auditService.export(
                TenantContext.getTenantIdOrDefault(), start, end));
    }
}
