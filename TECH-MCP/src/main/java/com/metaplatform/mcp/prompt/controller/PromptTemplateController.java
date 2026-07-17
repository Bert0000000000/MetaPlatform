package com.metaplatform.mcp.prompt.controller;

import com.metaplatform.mcp.common.ApiResponse;
import com.metaplatform.mcp.common.PageResponse;
import com.metaplatform.mcp.prompt.dto.CreatePromptTemplateRequest;
import com.metaplatform.mcp.prompt.dto.PromptTemplateResponse;
import com.metaplatform.mcp.prompt.dto.RenderRequest;
import com.metaplatform.mcp.prompt.dto.UpdatePromptTemplateRequest;
import com.metaplatform.mcp.prompt.service.PromptTemplateService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/mcp/prompts")
@RequiredArgsConstructor
public class PromptTemplateController {

    private final PromptTemplateService service;

    @PostMapping
    public ApiResponse<PromptTemplateResponse> create(@Valid @RequestBody CreatePromptTemplateRequest request) {
        return ApiResponse.success(service.create(request));
    }

    @GetMapping
    public ApiResponse<PageResponse<PromptTemplateResponse>> list(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return ApiResponse.success(service.list(status, category, keyword, page, size));
    }

    @GetMapping("/{id}")
    public ApiResponse<PromptTemplateResponse> get(@PathVariable UUID id) {
        return ApiResponse.success(service.get(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<PromptTemplateResponse> update(@PathVariable UUID id,
                                                      @Valid @RequestBody UpdatePromptTemplateRequest request) {
        return ApiResponse.success(service.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ApiResponse.success();
    }

    @PostMapping("/{id}/render")
    public ApiResponse<Map<String, Object>> render(@PathVariable UUID id,
                                                   @RequestBody RenderRequest request) {
        return ApiResponse.success(service.render(id, request.getVariables()));
    }

    @GetMapping("/{id}/preview")
    public ApiResponse<Map<String, Object>> preview(@PathVariable UUID id) {
        return ApiResponse.success(service.preview(id));
    }
}