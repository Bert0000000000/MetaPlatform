package com.metaplatform.ont.controller;

import com.metaplatform.ont.common.ApiResponse;
import com.metaplatform.ont.dto.CypherExecuteRequest;
import com.metaplatform.ont.dto.CypherExecuteResponse;
import com.metaplatform.ont.dto.CypherTemplateCreateRequest;
import com.metaplatform.ont.dto.CypherTemplateResponse;
import com.metaplatform.ont.service.CypherConsoleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Cypher 查询控制台（V12-05 REQ-062~063）。
 * 端点前缀：/api/v1/ont/cypher
 * <p>
 * - POST /execute：执行只读 Cypher 查询
 * - GET  /templates：列出查询模板（可按 category / keyword 过滤）
 * - GET  /templates/categories：分类列表
 * - POST /templates：保存模板
 * - PUT  /templates/{id}：更新模板
 * - DELETE /templates/{id}：删除模板
 */
@RestController
@RequestMapping("/api/v1/ont/cypher")
@RequiredArgsConstructor
public class CypherConsoleController {

    private final CypherConsoleService cypherConsoleService;

    @PostMapping("/execute")
    public ApiResponse<CypherExecuteResponse> execute(@Valid @RequestBody CypherExecuteRequest request) {
        return ApiResponse.success(cypherConsoleService.execute(request));
    }

    @GetMapping("/templates")
    public ApiResponse<List<CypherTemplateResponse>> listTemplates(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String keyword) {
        return ApiResponse.success(cypherConsoleService.listTemplates(category, keyword));
    }

    @GetMapping("/templates/categories")
    public ApiResponse<List<String>> listCategories() {
        return ApiResponse.success(cypherConsoleService.listCategories());
    }

    @GetMapping("/templates/{templateId}")
    public ApiResponse<CypherTemplateResponse> getTemplate(@PathVariable String templateId) {
        return ApiResponse.success(cypherConsoleService.getTemplate(templateId));
    }

    @PostMapping("/templates")
    public ApiResponse<CypherTemplateResponse> createTemplate(@Valid @RequestBody CypherTemplateCreateRequest request) {
        return ApiResponse.success(cypherConsoleService.createTemplate(request));
    }

    @PutMapping("/templates/{templateId}")
    public ApiResponse<CypherTemplateResponse> updateTemplate(@PathVariable String templateId,
                                                              @Valid @RequestBody CypherTemplateCreateRequest request) {
        return ApiResponse.success(cypherConsoleService.updateTemplate(templateId, request));
    }

    @DeleteMapping("/templates/{templateId}")
    public ApiResponse<Void> deleteTemplate(@PathVariable String templateId) {
        cypherConsoleService.deleteTemplate(templateId);
        return ApiResponse.success();
    }
}
