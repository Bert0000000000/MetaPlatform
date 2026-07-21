package com.metaplatform.mcp.alert.controller;

import com.metaplatform.mcp.alert.dto.AlertRuleResponse;
import com.metaplatform.mcp.alert.dto.CreateAlertRuleRequest;
import com.metaplatform.mcp.alert.dto.UpdateAlertRuleRequest;
import com.metaplatform.mcp.alert.service.McpAlertRuleService;
import com.metaplatform.mcp.common.ApiResponse;
import com.metaplatform.mcp.common.PageResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/mcp/alert-rules")
@RequiredArgsConstructor
public class McpAlertRuleController {

    private final McpAlertRuleService alertRuleService;

    @GetMapping
    public ApiResponse<PageResponse<AlertRuleResponse>> list(
            @RequestParam(required = false) Boolean enabled,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return ApiResponse.success(alertRuleService.list(enabled, page, size));
    }

    @GetMapping("/{id}")
    public ApiResponse<AlertRuleResponse> get(@PathVariable UUID id) {
        return ApiResponse.success(alertRuleService.get(id));
    }

    @PostMapping
    public ApiResponse<AlertRuleResponse> create(@Valid @RequestBody CreateAlertRuleRequest request) {
        return ApiResponse.success(alertRuleService.create(request));
    }

    @PutMapping("/{id}")
    public ApiResponse<AlertRuleResponse> update(@PathVariable UUID id,
                                                 @Valid @RequestBody UpdateAlertRuleRequest request) {
        return ApiResponse.success(alertRuleService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        alertRuleService.delete(id);
        return ApiResponse.success();
    }

    @PatchMapping("/{id}/enabled")
    public ApiResponse<AlertRuleResponse> toggle(@PathVariable UUID id,
                                                 @RequestParam boolean enabled) {
        return ApiResponse.success(alertRuleService.toggle(id, enabled));
    }
}
