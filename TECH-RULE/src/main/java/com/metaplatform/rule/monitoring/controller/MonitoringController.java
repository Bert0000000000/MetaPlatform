package com.metaplatform.rule.monitoring.controller;

import com.metaplatform.rule.common.ApiResponse;
import com.metaplatform.rule.common.PageResponse;
import com.metaplatform.rule.monitoring.dto.ExecutionHistoryItem;
import com.metaplatform.rule.monitoring.dto.MonitoringOverview;
import com.metaplatform.rule.monitoring.dto.RuleStats;
import com.metaplatform.rule.monitoring.service.MonitoringService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/v1/rule/monitoring")
@RequiredArgsConstructor
public class MonitoringController {

    private final MonitoringService monitoringService;

    @GetMapping("/overview")
    public ApiResponse<MonitoringOverview> overview() {
        return ApiResponse.success(monitoringService.overview());
    }

    @GetMapping("/by-rule")
    public ApiResponse<List<RuleStats>> byRule() {
        return ApiResponse.success(monitoringService.byRule());
    }

    @GetMapping("/errors")
    public ApiResponse<PageResponse<ExecutionHistoryItem>> errors(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        return ApiResponse.success(monitoringService.errors(page, pageSize));
    }

    @GetMapping("/history")
    public ApiResponse<PageResponse<ExecutionHistoryItem>> history(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant start,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant end,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        return ApiResponse.success(monitoringService.history(start, end, page, pageSize));
    }

    @GetMapping("/rules/{ruleId}")
    public ApiResponse<RuleStats> singleRuleStats(@PathVariable String ruleId) {
        return ApiResponse.success(monitoringService.singleRuleStats(ruleId));
    }
}
