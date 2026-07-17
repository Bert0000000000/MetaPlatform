package com.metaplatform.rule.testcase.controller;

import com.metaplatform.rule.common.ApiResponse;
import com.metaplatform.rule.testcase.dto.CreateTestCaseRequest;
import com.metaplatform.rule.testcase.dto.TestCaseResponse;
import com.metaplatform.rule.testcase.dto.TestCaseStatistics;
import com.metaplatform.rule.testcase.dto.UpdateTestCaseRequest;
import com.metaplatform.rule.testcase.service.TestCaseService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/rule/test-cases")
@RequiredArgsConstructor
public class TestCaseController {

    private final TestCaseService testCaseService;

    @PostMapping
    public ApiResponse<TestCaseResponse> create(@Valid @RequestBody CreateTestCaseRequest request) {
        return ApiResponse.success(testCaseService.create(request));
    }

    @GetMapping
    public ApiResponse<List<TestCaseResponse>> list(@RequestParam(required = false) String rulesetId) {
        return ApiResponse.success(testCaseService.list(rulesetId));
    }

    @GetMapping("/statistics")
    public ApiResponse<TestCaseStatistics> statistics() {
        return ApiResponse.success(testCaseService.statistics());
    }

    @GetMapping("/{id}")
    public ApiResponse<TestCaseResponse> get(@PathVariable String id) {
        return ApiResponse.success(testCaseService.getById(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<TestCaseResponse> update(@PathVariable String id,
                                                 @Valid @RequestBody UpdateTestCaseRequest request) {
        return ApiResponse.success(testCaseService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        testCaseService.delete(id);
        return ApiResponse.success();
    }

    @PostMapping("/{id}/run")
    public ApiResponse<TestCaseResponse> run(@PathVariable String id) {
        return ApiResponse.success(testCaseService.run(id));
    }

    @PostMapping("/batch-run")
    public ApiResponse<List<TestCaseResponse>> batchRun(@RequestParam String rulesetId) {
        return ApiResponse.success(testCaseService.batchRun(rulesetId));
    }
}
