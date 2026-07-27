package com.metaplatform.ea.governance.health.controller;

import com.metaplatform.ea.common.ApiResponse;
import com.metaplatform.ea.governance.health.dto.*;
import com.metaplatform.ea.governance.health.service.ArchitectureHealthService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/ea/governance/health")
@RequiredArgsConstructor
public class ArchitectureHealthController {

    private final ArchitectureHealthService healthService;

    @GetMapping
    public ApiResponse<HealthOverviewResponse> getOverview() {
        return ApiResponse.success(healthService.getOverview());
    }

    @GetMapping("/dimensions/{dimension}")
    public ApiResponse<DimensionHealthResponse> getDimensionDetail(@PathVariable String dimension) {
        return ApiResponse.success(healthService.getDimensionDetail(dimension));
    }

    @GetMapping("/risks")
    public ApiResponse<List<RiskItemResponse>> getRisks(
            @RequestParam(required = false) String severity) {
        return ApiResponse.success(healthService.getRisks(severity));
    }

    @GetMapping("/trends")
    public ApiResponse<HealthTrendResponse> getTrends(
            @RequestParam(defaultValue = "30") int days) {
        return ApiResponse.success(healthService.getTrends(days));
    }
}
