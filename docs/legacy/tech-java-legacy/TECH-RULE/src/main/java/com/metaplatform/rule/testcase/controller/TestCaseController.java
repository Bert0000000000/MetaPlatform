package com.metaplatform.rule.testcase.controller;

import com.metaplatform.rule.common.ApiResponse;
import com.metaplatform.rule.testcase.dto.CreateTestCaseRequest;
import com.metaplatform.rule.testcase.dto.TestCaseResponse;
import com.metaplatform.rule.testcase.dto.TestCaseStatistics;
import com.metaplatform.rule.testcase.dto.TestRunRequestDto;
import com.metaplatform.rule.testcase.dto.TestRunResultDto;
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

    /**
     * 列表查询。
     *
     * <p>V11-03 扩展：除原有的 {@code rulesetId} 过滤外，新增 {@code ruleId}、
     * {@code targetType}、{@code targetId} 三个查询参数，与前端 TestCase API 对齐。
     */
    @GetMapping
    public ApiResponse<List<TestCaseResponse>> list(
            @RequestParam(required = false) String rulesetId,
            @RequestParam(required = false) String ruleId,
            @RequestParam(required = false) String targetType,
            @RequestParam(required = false) String targetId) {

        // 任意 V11-03 维度参数存在时走扩展 list，否则回退到旧版仅 rulesetId 过滤
        if (ruleId != null || targetType != null || targetId != null) {
            return ApiResponse.success(
                    testCaseService.list(ruleId, targetType, targetId, rulesetId));
        }
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

    // ════════════════════════════════════════════
    // V11-03: 批量运行 + 聚合结果
    // ════════════════════════════════════════════

    /**
     * 批量运行测试用例并返回聚合结果。
     *
     * <p>路径与前端 {@code runTestCases} 一致：{@code POST /v1/rule/test-cases/run}。
     * 入参 {@link TestRunRequestDto}，返回 {@link TestRunResultDto}。
     */
    @PostMapping("/run")
    public ApiResponse<TestRunResultDto> run(@Valid @RequestBody TestRunRequestDto request) {
        return ApiResponse.success(testCaseService.runBatch(request));
    }
}
