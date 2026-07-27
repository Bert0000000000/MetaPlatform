package com.metaplatform.action.remediation.controller;

import com.metaplatform.action.common.ApiResponse;
import com.metaplatform.action.remediation.dto.RemediationRequest;
import com.metaplatform.action.remediation.dto.RemediationResponse;
import com.metaplatform.action.remediation.service.RemediationActionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequestMapping("/api/v1/action/remediate")
@RequiredArgsConstructor
public class RemediationController {

    private final RemediationActionService remediationActionService;

    @PostMapping
    public ApiResponse<RemediationResponse> remediate(@Valid @RequestBody RemediationRequest request) {
        log.debug("Remediation request: service={}, anomalyType={}, mode={}",
                request.getServiceName(), request.getAnomalyType(), request.getMode());
        return ApiResponse.success(remediationActionService.remediate(request));
    }
}
