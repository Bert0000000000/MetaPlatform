package com.metaplatform.rule.controller;

import com.metaplatform.rule.common.ApiResponse;
import com.metaplatform.rule.common.PageResponse;
import com.metaplatform.rule.dto.RuleDefinitionCreateRequest;
import com.metaplatform.rule.dto.RuleDefinitionResponse;
import com.metaplatform.rule.dto.RuleDefinitionUpdateRequest;
import com.metaplatform.rule.service.RuleDefinitionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/rule/rules")
@RequiredArgsConstructor
public class RuleDefinitionController {

    private final RuleDefinitionService ruleDefinitionService;

    @PostMapping
    public ApiResponse<RuleDefinitionResponse> create(@Valid @RequestBody RuleDefinitionCreateRequest request) {
        return ApiResponse.success(ruleDefinitionService.create(request));
    }

    @GetMapping
    public ApiResponse<PageResponse<RuleDefinitionResponse>> list(
            @RequestParam String rulesetId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        return ApiResponse.success(ruleDefinitionService.list(rulesetId, page, pageSize));
    }

    @GetMapping("/{id}")
    public ApiResponse<RuleDefinitionResponse> get(@PathVariable String id) {
        return ApiResponse.success(ruleDefinitionService.getById(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<RuleDefinitionResponse> update(@PathVariable String id,
                                                       @Valid @RequestBody RuleDefinitionUpdateRequest request) {
        return ApiResponse.success(ruleDefinitionService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        ruleDefinitionService.delete(id);
        return ApiResponse.success();
    }
}
