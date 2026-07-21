package com.metaplatform.mcp.monitor.controller;

import com.metaplatform.mcp.common.ApiResponse;
import com.metaplatform.mcp.monitor.dto.ConnectionMonitorResponse;
import com.metaplatform.mcp.monitor.service.ConnectionMonitorService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/mcp/connection-monitor")
@RequiredArgsConstructor
public class ConnectionMonitorController {

    private final ConnectionMonitorService connectionMonitorService;

    @GetMapping
    public ApiResponse<ConnectionMonitorResponse> getConnectionMonitor() {
        return ApiResponse.success(connectionMonitorService.getMonitor());
    }
}
