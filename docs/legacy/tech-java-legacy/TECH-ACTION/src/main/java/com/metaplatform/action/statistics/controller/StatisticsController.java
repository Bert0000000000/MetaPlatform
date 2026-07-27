package com.metaplatform.action.statistics.controller;

import com.metaplatform.action.common.ApiResponse;
import com.metaplatform.action.common.PageResponse;
import com.metaplatform.action.common.TenantContext;
import com.metaplatform.action.statistics.dto.ActionStats;
import com.metaplatform.action.statistics.dto.ExecutionHistoryItem;
import com.metaplatform.action.statistics.dto.StatsOverview;
import com.metaplatform.action.statistics.dto.TimelinePoint;
import com.metaplatform.action.statistics.service.StatisticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/v1/action/statistics")
@RequiredArgsConstructor
public class StatisticsController {

    private final StatisticsService statisticsService;

    @GetMapping("/overview")
    public ApiResponse<StatsOverview> overview(
            @RequestParam(required = false) Long startTime,
            @RequestParam(required = false) Long endTime) {
        String tenantId = TenantContext.getOrDefault();
        return ApiResponse.success(statisticsService.getOverview(tenantId, toInstant(startTime), toInstant(endTime)));
    }

    @GetMapping("/by-action")
    public ApiResponse<List<ActionStats>> byAction(
            @RequestParam(required = false) Long startTime,
            @RequestParam(required = false) Long endTime) {
        String tenantId = TenantContext.getOrDefault();
        return ApiResponse.success(statisticsService.getStatsByAction(tenantId, toInstant(startTime), toInstant(endTime)));
    }

    @GetMapping("/timeline")
    public ApiResponse<List<TimelinePoint>> timeline(
            @RequestParam(required = false) Long startTime,
            @RequestParam(required = false) Long endTime,
            @RequestParam(defaultValue = "HOUR") String interval) {
        String tenantId = TenantContext.getOrDefault();
        return ApiResponse.success(statisticsService.getTimeline(tenantId, toInstant(startTime), toInstant(endTime), interval));
    }

    @GetMapping("/executions")
    public ApiResponse<PageResponse<ExecutionHistoryItem>> executions(
            @RequestParam(required = false) String actionId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        String tenantId = TenantContext.getOrDefault();
        return ApiResponse.success(statisticsService.getExecutionHistory(tenantId, actionId, status, page, size));
    }

    private Instant toInstant(Long epochMillis) {
        return epochMillis == null ? null : Instant.ofEpochMilli(epochMillis);
    }
}
