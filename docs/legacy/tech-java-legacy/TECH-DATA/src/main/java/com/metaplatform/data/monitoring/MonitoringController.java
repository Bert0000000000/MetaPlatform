package com.metaplatform.data.monitoring;

import com.metaplatform.data.common.ApiResponse;
import com.metaplatform.data.common.PageResponse;
import com.metaplatform.data.monitoring.dto.AlertResponse;
import com.metaplatform.data.monitoring.dto.MonitoringLogResponse;
import com.metaplatform.data.monitoring.dto.MonitoringOverviewResponse;
import com.metaplatform.data.monitoring.dto.SlaResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 监控告警端点。
 *
 * <p>对应 Python app/api/v1/monitoring.py（7 个端点）。</p>
 */
@RestController
@RequestMapping("/api/v1/data/monitoring")
@RequiredArgsConstructor
public class MonitoringController {

    private final MonitoringService monitoringService;

    @GetMapping("/overview")
    public ApiResponse<MonitoringOverviewResponse> overview() {
        return ApiResponse.success(monitoringService.overview());
    }

    @GetMapping("/sla")
    public ApiResponse<PageResponse<SlaResponse>> sla(
            @RequestParam(required = false) String component,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        return ApiResponse.success(monitoringService.sla(component, page, pageSize));
    }

    @GetMapping("/alerts")
    public ApiResponse<PageResponse<AlertResponse>> alerts(
            @RequestParam(required = false) String severity,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        return ApiResponse.success(monitoringService.alerts(severity, status, page, pageSize));
    }

    @PostMapping("/alerts/{alertId}/ack")
    public ApiResponse<AlertResponse> ack(@PathVariable String alertId) {
        return ApiResponse.success(monitoringService.ack(alertId));
    }

    @PostMapping("/alerts/{alertId}/resolve")
    public ApiResponse<AlertResponse> resolve(@PathVariable String alertId) {
        return ApiResponse.success(monitoringService.resolve(alertId));
    }

    @GetMapping("/logs")
    public ApiResponse<PageResponse<MonitoringLogResponse>> logs(
            @RequestParam(required = false) String component,
            @RequestParam(required = false) String level,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        return ApiResponse.success(monitoringService.logs(component, level, page, pageSize));
    }
}
