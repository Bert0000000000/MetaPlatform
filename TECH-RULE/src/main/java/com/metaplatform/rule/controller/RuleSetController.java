package com.metaplatform.rule.controller;

import com.metaplatform.rule.common.ApiResponse;
import com.metaplatform.rule.common.PageResponse;
import com.metaplatform.rule.dto.*;
import com.metaplatform.rule.entity.RuleStatus;
import com.metaplatform.rule.service.RuleEngineService;
import com.metaplatform.rule.service.RuleExecutionService;
import com.metaplatform.rule.service.RuleSetService;
import com.metaplatform.rule.service.RuleSetVersionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/rule/rulesets")
@RequiredArgsConstructor
public class RuleSetController {

    private final RuleSetService ruleSetService;
    private final RuleExecutionService ruleExecutionService;
    private final RuleEngineService ruleEngineService;
    private final RuleSetVersionService ruleSetVersionService;

    @PostMapping
    public ApiResponse<RuleSetResponse> create(@Valid @RequestBody RuleSetCreateRequest request) {
        return ApiResponse.success(ruleSetService.create(request));
    }

    @GetMapping
    public ApiResponse<PageResponse<RuleSetResponse>> list(
            @RequestParam(required = false) RuleStatus status,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        return ApiResponse.success(ruleSetService.list(status, page, pageSize));
    }

    @GetMapping("/{id}")
    public ApiResponse<RuleSetResponse> get(@PathVariable String id) {
        return ApiResponse.success(ruleSetService.getById(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<RuleSetResponse> update(@PathVariable String id,
                                                @Valid @RequestBody RuleSetUpdateRequest request) {
        return ApiResponse.success(ruleSetService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        ruleSetService.delete(id);
        return ApiResponse.success();
    }

    @PatchMapping("/{id}/enable")
    public ApiResponse<RuleSetResponse> enable(@PathVariable String id) {
        return ApiResponse.success(ruleSetService.enable(id));
    }

    @PatchMapping("/{id}/disable")
    public ApiResponse<RuleSetResponse> disable(@PathVariable String id) {
        return ApiResponse.success(ruleSetService.disable(id));
    }

    @PostMapping("/{id}/execute")
    public ApiResponse<RuleExecutionResponse> execute(@PathVariable String id,
                                                       @RequestBody Map<String, Object> inputData) {
        return ApiResponse.success(ruleEngineService.executeRuleset(id, inputData));
    }

    @PostMapping("/execute-by-code")
    public ApiResponse<RuleExecutionResponse> executeByCode(@RequestParam String code,
                                                             @RequestBody Map<String, Object> inputData) {
        return ApiResponse.success(ruleEngineService.executeRulesetByCode(code, inputData));
    }

    @PostMapping("/{id}/versions")
    public ApiResponse<RuleSetVersionResponse> createVersion(@PathVariable String id,
                                                              @Valid @RequestBody RuleSetVersionCreateRequest request) {
        return ApiResponse.success(ruleSetVersionService.createVersion(id, request));
    }

    @GetMapping("/{id}/versions")
    public ApiResponse<PageResponse<RuleSetVersionResponse>> listVersions(@PathVariable String id,
                                                                          @RequestParam(defaultValue = "1") int page,
                                                                          @RequestParam(defaultValue = "20") int pageSize) {
        return ApiResponse.success(ruleSetVersionService.listVersions(id, page, pageSize));
    }

    @GetMapping("/versions/{versionId}")
    public ApiResponse<RuleSetVersionResponse> getVersion(@PathVariable String versionId) {
        return ApiResponse.success(ruleSetVersionService.getVersion(versionId));
    }
}
