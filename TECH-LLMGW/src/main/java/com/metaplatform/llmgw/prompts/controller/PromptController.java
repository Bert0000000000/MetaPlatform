package com.metaplatform.llmgw.prompts.controller;

import com.metaplatform.llmgw.common.ApiResponse;
import com.metaplatform.llmgw.prompts.dto.CreatePromptRequest;
import com.metaplatform.llmgw.prompts.dto.PromptDto;
import com.metaplatform.llmgw.prompts.dto.RenderPromptRequest;
import com.metaplatform.llmgw.prompts.dto.RenderTemplateRequest;
import com.metaplatform.llmgw.prompts.service.PromptService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/llmgw/prompts")
@RequiredArgsConstructor
public class PromptController {

    private final PromptService promptService;

    @GetMapping
    public ApiResponse<List<PromptDto>> list(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) Boolean activeOnly) {
        return ApiResponse.ok(promptService.listPrompts(category, activeOnly));
    }

    @GetMapping("/{id}")
    public ApiResponse<PromptDto> getById(@PathVariable Long id) {
        return ApiResponse.ok(promptService.getPrompt(id));
    }

    @PostMapping
    public ApiResponse<PromptDto> create(
            @RequestBody CreatePromptRequest request,
            @RequestHeader(value = "X-User-Id", defaultValue = "system") String createdBy) {
        return ApiResponse.ok(promptService.createPrompt(request, createdBy));
    }

    @PutMapping("/{id}")
    public ApiResponse<PromptDto> update(@PathVariable Long id, @RequestBody CreatePromptRequest request) {
        return ApiResponse.ok(promptService.updatePrompt(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        promptService.deletePrompt(id);
        return ApiResponse.ok(null);
    }

    @PostMapping("/{id}/rollback")
    public ApiResponse<PromptDto> rollback(@PathVariable Long id, @RequestParam Integer version) {
        return ApiResponse.ok(promptService.rollbackPrompt(id, version));
    }

    @PostMapping("/{id}/render")
    public ApiResponse<String> render(@PathVariable Long id, @RequestBody RenderPromptRequest request) {
        return ApiResponse.ok(promptService.renderPrompt(id, request.variables()));
    }

    @PostMapping("/render")
    public ApiResponse<String> renderTemplate(@RequestBody RenderTemplateRequest request) {
        return ApiResponse.ok(promptService.renderTemplate(request.templateText(), request.variables()));
    }
}
