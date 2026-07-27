package com.metaplatform.obs.controller;

import com.metaplatform.obs.common.ApiResponse;
import com.metaplatform.obs.dto.DashboardMetricCard;
import com.metaplatform.obs.dto.DashboardTrendPoint;
import com.metaplatform.obs.service.DashboardMetricService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/obs/dashboard")
@RequiredArgsConstructor
public class DashboardMetricController {

    private final DashboardMetricService dashboardMetricService;

    @GetMapping("/cards")
    public ApiResponse<List<DashboardMetricCard>> getCards() {
        return ApiResponse.success(dashboardMetricService.getCards());
    }

    @GetMapping("/trend")
    public ApiResponse<List<DashboardTrendPoint>> getTrend(@RequestParam(defaultValue = "24h") String range) {
        return ApiResponse.success(dashboardMetricService.getTrend(range));
    }
}
