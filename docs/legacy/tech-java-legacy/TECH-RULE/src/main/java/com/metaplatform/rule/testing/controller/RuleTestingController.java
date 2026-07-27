package com.metaplatform.rule.testing.controller;

import com.metaplatform.rule.common.ApiResponse;
import com.metaplatform.rule.testing.dto.BatchTestRequest;
import com.metaplatform.rule.testing.dto.BatchTestResult;
import com.metaplatform.rule.testing.dto.DecisionTableTestResult;
import com.metaplatform.rule.testing.dto.RuleTestRequest;
import com.metaplatform.rule.testing.dto.RuleTestResult;
import com.metaplatform.rule.testing.dto.RulesetTestResult;
import com.metaplatform.rule.testing.service.RuleTestingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/rule")
@RequiredArgsConstructor
public class RuleTestingController {

    private final RuleTestingService ruleTestingService;

    @PostMapping("/rules/{id}/test")
    public ApiResponse<RuleTestResult> testRule(@PathVariable String id,
                                                 @Valid @RequestBody RuleTestRequest request) {
        return ApiResponse.success(ruleTestingService.testRule(id, request));
    }

    @PostMapping("/rulesets/{id}/test")
    public ApiResponse<RulesetTestResult> testRuleset(@PathVariable String id,
                                                       @Valid @RequestBody RuleTestRequest request) {
        return ApiResponse.success(ruleTestingService.testRuleset(id, request));
    }

    @PostMapping("/decision-tables/{id}/test")
    public ApiResponse<DecisionTableTestResult> testDecisionTable(@PathVariable String id,
                                                                   @Valid @RequestBody RuleTestRequest request) {
        return ApiResponse.success(ruleTestingService.testDecisionTable(id, request));
    }

    @PostMapping("/rules/batch-test")
    public ApiResponse<BatchTestResult> batchTest(@Valid @RequestBody BatchTestRequest request) {
        return ApiResponse.success(ruleTestingService.batchTest(request));
    }
}
