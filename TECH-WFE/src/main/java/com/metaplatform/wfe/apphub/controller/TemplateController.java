package com.metaplatform.wfe.apphub.controller;

import com.metaplatform.wfe.apphub.dto.TemplateCommentRequest;
import com.metaplatform.wfe.apphub.dto.TemplateCommentResponse;
import com.metaplatform.wfe.apphub.dto.TemplateInstallResponse;
import com.metaplatform.wfe.apphub.dto.TemplateResponse;
import com.metaplatform.wfe.apphub.service.TemplateService;
import com.metaplatform.wfe.common.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 市场模板 API（V11-08）：路径前缀 /api/v1/apphub。
 * 对齐 APP-APPHUB 前端 marketplace.ts 的调用：
 *   GET    /v1/apphub/templates?keyword=&category=
 *   GET    /v1/apphub/templates/{id}
 *   POST   /v1/apphub/templates/{id}/install
 *   GET    /v1/apphub/templates/{id}/comments
 *   POST   /v1/apphub/templates/{id}/comments
 */
@RestController
@RequestMapping("/api/v1/apphub")
@RequiredArgsConstructor
public class TemplateController {

    private final TemplateService templateService;

    @GetMapping("/templates")
    public ApiResponse<List<TemplateResponse>> list(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String category) {
        return ApiResponse.success(templateService.list(keyword, category));
    }

    @GetMapping("/templates/{id}")
    public ApiResponse<TemplateResponse> get(@PathVariable String id) {
        return ApiResponse.success(templateService.get(id));
    }

    @PostMapping("/templates/{id}/install")
    public ApiResponse<TemplateInstallResponse> install(@PathVariable String id) {
        return ApiResponse.success(templateService.install(id));
    }

    @GetMapping("/templates/{id}/comments")
    public ApiResponse<List<TemplateCommentResponse>> listComments(
            @PathVariable String id,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success(templateService.listComments(id, page, size));
    }

    @PostMapping("/templates/{id}/comments")
    public ApiResponse<TemplateCommentResponse> addComment(
            @PathVariable String id,
            @Valid @RequestBody TemplateCommentRequest request) {
        return ApiResponse.success(templateService.addOrUpdateComment(id, request));
    }
}
