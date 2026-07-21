package com.metaplatform.ea.impact.controller;

import com.metaplatform.ea.common.ApiResponse;
import com.metaplatform.ea.impact.dto.ImpactAnalysisRequest;
import com.metaplatform.ea.impact.dto.ImpactAnalysisResponse;
import com.metaplatform.ea.impact.service.ImpactAnalysisService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 能力影响分析 API（V11-09 补齐）。
 *
 * <p>路径 /api/v1/ea/impact-analysis 与 APP-ARCH 前端约定一致。
 */
@RestController
@RequestMapping("/api/v1/ea/impact-analysis")
@RequiredArgsConstructor
public class ImpactAnalysisController {

    private final ImpactAnalysisService service;

    @PostMapping
    public ApiResponse<ImpactAnalysisResponse> analyze(@Valid @RequestBody ImpactAnalysisRequest request) {
        return ApiResponse.success(service.analyze(request.getCapabilityId()));
    }
}
