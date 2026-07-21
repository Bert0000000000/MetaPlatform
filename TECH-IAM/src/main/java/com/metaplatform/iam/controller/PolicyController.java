package com.metaplatform.iam.controller;

import com.metaplatform.iam.common.ApiResponse;
import com.metaplatform.iam.common.PageResponse;
import com.metaplatform.iam.dto.policy.ConditionSyntaxResponse;
import com.metaplatform.iam.dto.policy.CreatePolicyRequest;
import com.metaplatform.iam.dto.policy.PolicyMatrixResponse;
import com.metaplatform.iam.dto.policy.PolicyResponse;
import com.metaplatform.iam.dto.policy.UpdatePolicyRequest;
import com.metaplatform.iam.service.PolicyService;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/api/v1/iam/policies")
@RequiredArgsConstructor
public class PolicyController {

    private final PolicyService policyService;

    @PostMapping
    public ApiResponse<PolicyResponse> create(@Valid @RequestBody CreatePolicyRequest request) {
        return ApiResponse.success(policyService.create(request));
    }

    @GetMapping
    public ApiResponse<PageResponse<PolicyResponse>> list(
            @RequestParam(required = false) String tenantId,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String subjectType,
            @RequestParam(required = false) String subjectId,
            @RequestParam(required = false) String resourceType,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return ApiResponse.success(policyService.list(tenantId, keyword, subjectType, subjectId, resourceType, page, size));
    }

    @GetMapping("/{id}")
    public ApiResponse<PolicyResponse> get(@PathVariable String id) {
        return ApiResponse.success(policyService.get(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<PolicyResponse> update(@PathVariable String id,
                                               @Valid @RequestBody UpdatePolicyRequest request) {
        return ApiResponse.success(policyService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        policyService.delete(id);
        return ApiResponse.success();
    }

    @GetMapping("/matrix")
    public ApiResponse<PolicyMatrixResponse> matrix(
            @RequestParam String type,
            @RequestParam(required = false) String action) {
        return ApiResponse.success(policyService.buildMatrix(type, action));
    }

    @GetMapping(value = "/matrix/export", produces = MediaType.APPLICATION_OCTET_STREAM_VALUE)
    public void exportMatrix(@RequestParam String type,
                             @RequestParam(required = false, defaultValue = "csv") String format,
                             @RequestParam(required = false) String action,
                             HttpServletResponse response) throws IOException {
        PolicyMatrixResponse matrix = policyService.buildMatrix(type, action);
        byte[] data = policyService.exportMatrix(matrix, format);
        String filename = "policy-matrix-" + type + "." + format.toLowerCase();
        response.setHeader(HttpHeaders.CONTENT_DISPOSITION,
                "attachment; filename=\"" + URLEncoder.encode(filename, StandardCharsets.UTF_8) + "\"");
        response.setContentType("xlsx".equalsIgnoreCase(format)
                ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                : "text/csv;charset=UTF-8");
        response.setContentLength(data.length);
        response.getOutputStream().write(data);
        response.getOutputStream().flush();
    }

    @GetMapping("/condition-syntax")
    public ApiResponse<ConditionSyntaxResponse> conditionSyntax() {
        return ApiResponse.success(policyService.conditionSyntax());
    }
}
