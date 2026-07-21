package com.metaplatform.wfe.form.controller;

import com.metaplatform.wfe.common.ApiResponse;
import com.metaplatform.wfe.form.dto.*;
import com.metaplatform.wfe.form.service.FormDefinitionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/**
 * 表单高级能力 API（V13-13）：全局设置、数据联动、表单脚本、端到端校验。
 * 路径前缀 /api/v1/wfe/forms。
 */
@RestController
@RequestMapping("/api/v1/wfe/forms")
@RequiredArgsConstructor
public class FormController {

    private final FormDefinitionService formDefinitionService;

    @GetMapping("/{id}")
    public ApiResponse<FormDefinitionResponse> get(@PathVariable("id") String formId) {
        return ApiResponse.success(formDefinitionService.get(formId));
    }

    @PutMapping("/{id}/settings")
    public ApiResponse<FormDefinitionResponse> saveSettings(
            @PathVariable("id") String formId,
            @Valid @RequestBody FormGlobalSettingsRequest request) {
        return ApiResponse.success(formDefinitionService.saveSettings(formId, request));
    }

    @PutMapping("/{id}/linkage-rules")
    public ApiResponse<FormDefinitionResponse> saveLinkageRules(
            @PathVariable("id") String formId,
            @Valid @RequestBody FormLinkageRulesRequest request) {
        return ApiResponse.success(formDefinitionService.saveLinkageRules(formId, request));
    }

    @PutMapping("/{id}/scripts")
    public ApiResponse<FormDefinitionResponse> saveScripts(
            @PathVariable("id") String formId,
            @RequestBody FormScriptsRequest request) {
        return ApiResponse.success(formDefinitionService.saveScripts(formId, request));
    }

    @PostMapping("/{id}/validate")
    public ApiResponse<FormValidateResponse> validate(
            @PathVariable("id") String formId,
            @Valid @RequestBody FormValidateRequest request) {
        return ApiResponse.success(formDefinitionService.validate(formId, request));
    }
}
