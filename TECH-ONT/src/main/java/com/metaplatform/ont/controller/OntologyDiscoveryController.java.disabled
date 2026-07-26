package com.metaplatform.ont.controller;

import com.metaplatform.ont.common.ApiResponse;
import com.metaplatform.ont.common.TenantContext;
import com.metaplatform.ont.dto.AnalyzeRequest;
import com.metaplatform.ont.dto.DataSourceDto;
import com.metaplatform.ont.dto.DiscoveryResponse;
import com.metaplatform.ont.dto.ImportRequest;
import com.metaplatform.ont.dto.SuggestRequest;
import com.metaplatform.ont.service.OntologyDiscoveryService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 替代原 Python FastAPI /api/v1/ont/discovery/*
 * 4 个端点与 Python 端点行为对齐
 */
@RestController
@RequestMapping("/api/v1/ont/discovery")
@RequiredArgsConstructor
public class OntologyDiscoveryController {

    private final OntologyDiscoveryService service;

    @GetMapping("/data-sources")
    public ApiResponse<List<DataSourceDto>> getDataSources() {
        return ApiResponse.success(service.getDataSources());
    }

    @PostMapping("/analyze")
    public ApiResponse<DiscoveryResponse> analyze(@RequestBody AnalyzeRequest request) {
        String tenantId = TenantContext.get();
        return ApiResponse.success(service.analyze(tenantId, request.getSourceId(), request.getTables()));
    }

    @PostMapping("/{sourceId}/suggest")
    public ApiResponse<DiscoveryResponse> suggest(
            @PathVariable String sourceId,
            @RequestBody SuggestRequest request
    ) {
        String tenantId = TenantContext.get();
        return ApiResponse.success(service.suggest(tenantId, sourceId, request));
    }

    @PostMapping("/import")
    public ApiResponse<DiscoveryResponse> importCandidates(@RequestBody ImportRequest request) {
        String tenantId = TenantContext.get();
        return ApiResponse.success(service.importCandidates(tenantId, request));
    }
}
