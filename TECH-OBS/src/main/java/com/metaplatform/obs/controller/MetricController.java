package com.metaplatform.obs.controller;

import com.metaplatform.obs.common.ApiResponse;
import com.metaplatform.obs.dto.MetricInfo;
import com.metaplatform.obs.dto.MetricQueryRequest;
import com.metaplatform.obs.dto.MetricQueryResponse;
import com.metaplatform.obs.service.MetricService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/v1/obs/metrics")
@RequiredArgsConstructor
public class MetricController {

    private final MetricService metricService;

    @GetMapping
    public ApiResponse<List<MetricInfo>> listMetrics() {
        log.debug("List metrics request");
        return ApiResponse.success(metricService.listMetrics());
    }

    @GetMapping("/{name}")
    public ApiResponse<MetricInfo> getMetricMetadata(@PathVariable String name) {
        log.debug("Get metric metadata: {}", name);
        return ApiResponse.success(metricService.getMetricMetadata(name));
    }

    @PostMapping("/query")
    public ApiResponse<MetricQueryResponse> queryMetrics(@Valid @RequestBody MetricQueryRequest request) {
        log.debug("Query metrics: metric={}, step={}", request.getMetricName(), request.getStep());
        return ApiResponse.success(metricService.queryMetrics(request));
    }
}
