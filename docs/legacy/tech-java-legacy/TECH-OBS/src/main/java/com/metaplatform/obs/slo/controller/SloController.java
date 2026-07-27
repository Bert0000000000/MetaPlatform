package com.metaplatform.obs.slo.controller;

import com.metaplatform.obs.common.ApiResponse;
import com.metaplatform.obs.slo.dto.ErrorBudget;
import com.metaplatform.obs.slo.dto.SloReport;
import com.metaplatform.obs.slo.dto.SloRequest;
import com.metaplatform.obs.slo.entity.SloEntity;
import com.metaplatform.obs.slo.service.SloService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/v1/obs/slos")
@RequiredArgsConstructor
public class SloController {

    private final SloService sloService;

    @PostMapping
    public ApiResponse<SloEntity> create(@Valid @RequestBody SloRequest request) {
        log.debug("Create SLO: {}", request.getName());
        return ApiResponse.success(sloService.create(request));
    }

    @GetMapping
    public ApiResponse<List<SloEntity>> list() {
        log.debug("List SLOs");
        return ApiResponse.success(sloService.list());
    }

    @GetMapping("/{id}")
    public ApiResponse<SloEntity> get(@PathVariable UUID id) {
        log.debug("Get SLO: {}", id);
        return ApiResponse.success(sloService.get(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<SloEntity> update(@PathVariable UUID id,
                                         @Valid @RequestBody SloRequest request) {
        log.debug("Update SLO: {}", id);
        return ApiResponse.success(sloService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        log.debug("Delete SLO: {}", id);
        sloService.delete(id);
        return ApiResponse.success();
    }

    @GetMapping("/{id}/error-budget")
    public ApiResponse<ErrorBudget> getErrorBudget(@PathVariable UUID id) {
        log.debug("Get error budget for SLO: {}", id);
        return ApiResponse.success(sloService.getErrorBudget(id));
    }

    @GetMapping("/{id}/report")
    public ApiResponse<SloReport> getReport(@PathVariable UUID id,
                                            @RequestParam(required = false, defaultValue = "30d") String period) {
        log.debug("Generate SLO report: {}, period={}", id, period);
        return ApiResponse.success(sloService.generateReport(id, period));
    }
}