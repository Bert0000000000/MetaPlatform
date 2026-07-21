package com.metaplatform.ea.deployment.controller;

import com.metaplatform.ea.common.ApiResponse;
import com.metaplatform.ea.deployment.dto.CreateDeploymentTopologyRequest;
import com.metaplatform.ea.deployment.dto.DeploymentTopologyResponse;
import com.metaplatform.ea.deployment.dto.UpdateDeploymentTopologyRequest;
import com.metaplatform.ea.deployment.service.DeploymentTopologyService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/ea/deployments")
@RequiredArgsConstructor
public class DeploymentTopologyController {

    private final DeploymentTopologyService service;

    @PostMapping
    public ApiResponse<DeploymentTopologyResponse> create(@Valid @RequestBody CreateDeploymentTopologyRequest request) {
        return ApiResponse.success(service.create(request));
    }

    @GetMapping
    public ApiResponse<List<DeploymentTopologyResponse>> list(@RequestParam(required = false) String environment) {
        if (environment != null && !environment.isBlank()) {
            return ApiResponse.success(service.listByEnvironment(environment));
        }
        return ApiResponse.success(service.list());
    }

    @GetMapping("/{id}")
    public ApiResponse<DeploymentTopologyResponse> get(@PathVariable UUID id) {
        return ApiResponse.success(service.get(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<DeploymentTopologyResponse> update(@PathVariable UUID id,
                                                           @Valid @RequestBody UpdateDeploymentTopologyRequest request) {
        return ApiResponse.success(service.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ApiResponse.success();
    }
}
