package com.metaplatform.llmgw.code.controller;

import com.metaplatform.llmgw.code.dto.*;
import com.metaplatform.llmgw.code.service.CodeGenerationService;
import com.metaplatform.llmgw.code.service.CodeSnippetService;
import com.metaplatform.llmgw.code.service.CodeTemplateService;
import com.metaplatform.llmgw.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/llmgw/code")
@RequiredArgsConstructor
public class CodeController {

    private final CodeTemplateService codeTemplateService;
    private final CodeSnippetService codeSnippetService;
    private final CodeGenerationService codeGenerationService;

    @GetMapping("/templates")
    public ApiResponse<List<CodeTemplateDto>> listTemplates() {
        return ApiResponse.ok(codeTemplateService.listAll());
    }

    @GetMapping("/templates/{id}")
    public ApiResponse<CodeTemplateDto> getTemplate(@PathVariable Long id) {
        return ApiResponse.ok(codeTemplateService.getById(id));
    }

    @PostMapping("/templates")
    public ApiResponse<CodeTemplateDto> createTemplate(@RequestBody CreateCodeTemplateRequest request) {
        return ApiResponse.ok(codeTemplateService.create(request));
    }

    @PutMapping("/templates/{id}")
    public ApiResponse<CodeTemplateDto> updateTemplate(@PathVariable Long id, @RequestBody CreateCodeTemplateRequest request) {
        return ApiResponse.ok(codeTemplateService.update(id, request));
    }

    @DeleteMapping("/templates/{id}")
    public ApiResponse<Void> deleteTemplate(@PathVariable Long id) {
        codeTemplateService.delete(id);
        return ApiResponse.ok(null);
    }

    @PostMapping("/templates/{id}/render")
    public ApiResponse<String> renderTemplate(@PathVariable Long id, @RequestBody RenderTemplateRequest request) {
        return ApiResponse.ok(codeTemplateService.render(id, request.variables()));
    }

    @GetMapping("/snippets")
    public ApiResponse<List<CodeSnippetDto>> listSnippets(@RequestParam(required = false) String language) {
        if (language == null || language.isBlank()) {
            return ApiResponse.ok(codeSnippetService.listAll());
        }
        return ApiResponse.ok(codeSnippetService.listByLanguage(language));
    }

    @GetMapping("/snippets/{id}")
    public ApiResponse<CodeSnippetDto> getSnippet(@PathVariable Long id) {
        return ApiResponse.ok(codeSnippetService.getById(id));
    }

    @PostMapping("/snippets")
    public ApiResponse<CodeSnippetDto> createSnippet(@RequestBody CreateCodeSnippetRequest request) {
        return ApiResponse.ok(codeSnippetService.create(request));
    }

    @PutMapping("/snippets/{id}")
    public ApiResponse<CodeSnippetDto> updateSnippet(@PathVariable Long id, @RequestBody CreateCodeSnippetRequest request) {
        return ApiResponse.ok(codeSnippetService.update(id, request));
    }

    @DeleteMapping("/snippets/{id}")
    public ApiResponse<Void> deleteSnippet(@PathVariable Long id) {
        codeSnippetService.delete(id);
        return ApiResponse.ok(null);
    }

    @PostMapping("/generate")
    public ApiResponse<GenerateCodeResponse> generateCode(@RequestBody GenerateCodeRequest request) {
        return ApiResponse.ok(codeGenerationService.generateCode(request));
    }
}
