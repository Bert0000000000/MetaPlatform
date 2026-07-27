package com.metaplatform.rule.statistics.controller;

import com.metaplatform.rule.common.ApiResponse;
import com.metaplatform.rule.common.PageResponse;
import com.metaplatform.rule.statistics.dto.ErrorItem;
import com.metaplatform.rule.statistics.dto.StatisticsOverview;
import com.metaplatform.rule.statistics.dto.TargetStats;
import com.metaplatform.rule.statistics.dto.TimelinePoint;
import com.metaplatform.rule.statistics.entity.RuleExecutionStatEntity;
import com.metaplatform.rule.statistics.service.StatisticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1/rule/statistics")
@RequiredArgsConstructor
public class StatisticsController {

    private final StatisticsService statisticsService;

    @GetMapping("/overview")
    public ApiResponse<StatisticsOverview> overview() {
        return ApiResponse.success(statisticsService.overview());
    }

    @GetMapping("/by-target")
    public ApiResponse<List<TargetStats>> byTarget() {
        return ApiResponse.success(statisticsService.byTarget());
    }

    @GetMapping("/timeline")
    public ApiResponse<List<TimelinePoint>> timeline(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate start,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate end) {
        return ApiResponse.success(statisticsService.timeline(start, end));
    }

    @GetMapping("/history")
    public ApiResponse<PageResponse<RuleExecutionStatEntity>> history(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        return ApiResponse.success(statisticsService.history(page, pageSize));
    }

    @GetMapping("/errors")
    public ApiResponse<PageResponse<ErrorItem>> errors(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        return ApiResponse.success(statisticsService.errors(page, pageSize));
    }

    @GetMapping("/single/{id}")
    public ApiResponse<TargetStats> single(@PathVariable String id,
                                            @RequestParam String targetType) {
        return ApiResponse.success(statisticsService.single(targetType, id));
    }
}
