package com.metaplatform.rule.controller;

import com.metaplatform.rule.common.ApiResponse;
import com.metaplatform.rule.common.PageResponse;
import com.metaplatform.rule.dto.*;
import com.metaplatform.rule.entity.RuleStatus;
import com.metaplatform.rule.service.RuleExecutionService;
import com.metaplatform.rule.service.RuleSetService;
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

    @PostMapping("/{id}/execute")
    public ApiResponse<List<RuleExecutionResult>> execute(@PathVariable String id,
                                                           @RequestBody Map<String, Object> inputData) {
        return ApiResponse.success(ruleExecutionService.execute(id, inputData));
    }
}
