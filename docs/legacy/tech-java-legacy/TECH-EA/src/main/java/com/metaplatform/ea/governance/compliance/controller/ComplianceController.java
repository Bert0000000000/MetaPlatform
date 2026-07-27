package com.metaplatform.ea.governance.compliance.controller;

import com.metaplatform.ea.common.ApiResponse;
import com.metaplatform.ea.governance.compliance.dto.ComplianceResult;
import com.metaplatform.ea.governance.compliance.service.ComplianceAssessmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * 架构合规性评估 REST API。
 *
 * <p>路径前缀 {@code /api/v1/ea/compliance}。
 */
@RestController
@RequestMapping("/api/v1/ea/compliance")
@RequiredArgsConstructor
public class ComplianceController {

    private final ComplianceAssessmentService assessmentService;

    @GetMapping("/applications/{applicationId}")
    public ApiResponse<ComplianceResult> assessApplication(@PathVariable UUID applicationId) {
        return ApiResponse.success(assessmentService.assessApplication(applicationId));
    }

    @GetMapping("/tech-stacks/{techStackId}")
    public ApiResponse<ComplianceResult> assessTechStack(@PathVariable UUID techStackId) {
        return ApiResponse.success(assessmentService.assessTechStack(techStackId));
    }
}
