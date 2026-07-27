package com.metaplatform.obs.topology.controller;

import com.metaplatform.obs.common.ApiResponse;
import com.metaplatform.obs.topology.dto.ServiceDependenciesResponse;
import com.metaplatform.obs.topology.dto.ServiceTopologyResponse;
import com.metaplatform.obs.topology.entity.ServiceHealthEntity;
import com.metaplatform.obs.topology.service.TopologyService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/v1/obs/service-topology")
@RequiredArgsConstructor
public class TopologyController {

    private final TopologyService topologyService;

    @GetMapping
    public ApiResponse<ServiceTopologyResponse> getTopology() {
        log.debug("Get service topology");
        return ApiResponse.success(topologyService.getTopology());
    }

    @GetMapping("/{service}/dependencies")
    public ApiResponse<ServiceDependenciesResponse> getServiceDependencies(@PathVariable String service) {
        log.debug("Get service dependencies: {}", service);
        return ApiResponse.success(topologyService.getServiceDependencies(service));
    }

    @PostMapping("/refresh")
    public ApiResponse<Integer> refreshHealth() {
        log.debug("Refresh service health");
        return ApiResponse.success(topologyService.refreshHealth());
    }

    @GetMapping("/health")
    public ApiResponse<List<ServiceHealthEntity>> getAllHealth() {
        log.debug("Get all service health");
        return ApiResponse.success(topologyService.getHealth());
    }

    @GetMapping("/health/{service}")
    public ApiResponse<ServiceHealthEntity> getServiceHealth(@PathVariable String service) {
        log.debug("Get service health: {}", service);
        return ApiResponse.success(topologyService.getServiceHealth(service));
    }

    @PostMapping("/health/report")
    public ApiResponse<ServiceHealthEntity> reportHealth(@RequestParam String service,
                                                         @RequestParam String status,
                                                         @RequestParam(defaultValue = "0") double responseTimeMs,
                                                         @RequestParam(defaultValue = "0") double errorRate) {
        log.debug("Report service health: {}, status={}", service, status);
        return ApiResponse.success(topologyService.reportHealth(service, status, responseTimeMs, errorRate));
    }
}