package com.metaplatform.data.quality;

import com.metaplatform.data.common.ApiResponse;
import com.metaplatform.data.common.PageResponse;
import com.metaplatform.data.quality.dto.CreateQualityRuleRequest;
import com.metaplatform.data.quality.dto.QualityCheckResultResponse;
import com.metaplatform.data.quality.dto.QualityIssueResponse;
import com.metaplatform.data.quality.dto.QualityOverviewResponse;
import com.metaplatform.data.quality.dto.QualityReportResponse;
import com.metaplatform.data.quality.dto.QualityRuleResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 数据质量端点。
 *
 * <p>对应 Python app/api/v1/quality.py（11 个端点）。</p>
 */
@RestController
@RequestMapping("/api/v1/data/quality")
@RequiredArgsConstructor
public class QualityController {

    private final QualityService qualityService;

    @PostMapping("/rules")
    public ApiResponse<QualityRuleResponse> createRule(@Valid @RequestBody CreateQualityRuleRequest request) {
        return ApiResponse.success(qualityService.createRule(request));
    }

    @GetMapping("/rules")
    public ApiResponse<PageResponse<QualityRuleResponse>> listRules(
            @RequestParam(required = false) String targetAssetId,
            @RequestParam(required = false) String ruleType,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        return ApiResponse.success(qualityService.listRules(targetAssetId, ruleType, page, pageSize));
    }

    @GetMapping("/rules/{ruleId}")
    public ApiResponse<QualityRuleResponse> getRule(@PathVariable String ruleId) {
        return ApiResponse.success(qualityService.getRule(ruleId));
    }

    @DeleteMapping("/rules/{ruleId}")
    public ApiResponse<Map<String, Object>> deleteRule(@PathVariable String ruleId) {
        boolean ok = qualityService.deleteRule(ruleId);
        return ApiResponse.success(Map.of("deleted", ok, "ruleId", ruleId));
    }

    @GetMapping("/overview")
    public ApiResponse<QualityOverviewResponse> overview() {
        return ApiResponse.success(qualityService.overview());
    }

    @GetMapping("/issues")
    public ApiResponse<PageResponse<QualityIssueResponse>> issues(
            @RequestParam(required = false) String targetAssetId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        return ApiResponse.success(qualityService.issues(targetAssetId, page, pageSize));
    }

    @PostMapping("/rules/{ruleId}/run")
    public ApiResponse<QualityCheckResultResponse> run(@PathVariable String ruleId) {
        return ApiResponse.success(qualityService.run(ruleId));
    }

    @GetMapping("/rules/{ruleId}/checks")
    public ApiResponse<PageResponse<QualityCheckResultResponse>> checks(
            @PathVariable String ruleId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        return ApiResponse.success(qualityService.checks(ruleId, page, pageSize));
    }

    @PostMapping("/reports")
    public ApiResponse<QualityReportResponse> generateReport(@RequestParam String targetAssetId) {
        return ApiResponse.success(qualityService.generateReport(targetAssetId));
    }

    @GetMapping("/dashboard")
    public ApiResponse<QualityOverviewResponse> dashboard() {
        return ApiResponse.success(qualityService.dashboard());
    }
}
