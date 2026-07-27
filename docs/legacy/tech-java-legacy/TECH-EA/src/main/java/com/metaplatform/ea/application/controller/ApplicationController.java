package com.metaplatform.ea.application.controller;

import com.metaplatform.ea.common.ApiResponse;
import com.metaplatform.ea.application.dto.AddDependencyRequest;
import com.metaplatform.ea.application.dto.ApplicationResponse;
import com.metaplatform.ea.application.dto.CreateApplicationRequest;
import com.metaplatform.ea.application.dto.DependencyGraph;
import com.metaplatform.ea.application.dto.UpdateApplicationRequest;
import com.metaplatform.ea.application.service.ApplicationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/ea/applications")
@RequiredArgsConstructor
public class ApplicationController {

    private final ApplicationService applicationService;

    @PostMapping
    public ApiResponse<ApplicationResponse> create(@Valid @RequestBody CreateApplicationRequest request) {
        return ApiResponse.success(applicationService.create(request));
    }

    @GetMapping
    public ApiResponse<List<ApplicationResponse>> list() {
        return ApiResponse.success(applicationService.list());
    }

    @GetMapping("/{id}")
    public ApiResponse<ApplicationResponse> get(@PathVariable UUID id) {
        return ApiResponse.success(applicationService.get(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<ApplicationResponse> update(@PathVariable UUID id,
                                                    @Valid @RequestBody UpdateApplicationRequest request) {
        return ApiResponse.success(applicationService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        applicationService.delete(id);
        return ApiResponse.success();
    }

    @GetMapping("/{id}/dependencies")
    public ApiResponse<DependencyGraph> dependencyGraph(@PathVariable UUID id) {
        return ApiResponse.success(applicationService.dependencyGraph(id));
    }

    @GetMapping("/{id}/impact")
    public ApiResponse<Map<String, Object>> impactAnalysis(@PathVariable UUID id) {
        return ApiResponse.success(applicationService.impactAnalysis(id));
    }

    @PostMapping("/{id}/dependencies")
    public ApiResponse<ApplicationResponse> addDependency(@PathVariable UUID id,
                                                          @Valid @RequestBody AddDependencyRequest request) {
        return ApiResponse.success(applicationService.addDependency(id, request));
    }
}
