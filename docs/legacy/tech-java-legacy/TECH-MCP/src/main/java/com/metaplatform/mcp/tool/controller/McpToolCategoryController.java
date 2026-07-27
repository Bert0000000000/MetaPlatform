package com.metaplatform.mcp.tool.controller;

import com.metaplatform.mcp.common.ApiResponse;
import com.metaplatform.mcp.tool.dto.CreateMcpToolCategoryRequest;
import com.metaplatform.mcp.tool.dto.McpToolCategoryResponse;
import com.metaplatform.mcp.tool.dto.UpdateMcpToolCategoryRequest;
import com.metaplatform.mcp.tool.service.McpToolCategoryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/mcp/tool-categories")
@RequiredArgsConstructor
public class McpToolCategoryController {

    private final McpToolCategoryService categoryService;

    @PostMapping
    public ApiResponse<McpToolCategoryResponse> create(@Valid @RequestBody CreateMcpToolCategoryRequest request) {
        return ApiResponse.success(categoryService.create(request));
    }

    @GetMapping
    public ApiResponse<List<McpToolCategoryResponse>> list() {
        return ApiResponse.success(categoryService.list());
    }

    @GetMapping("/{id}")
    public ApiResponse<McpToolCategoryResponse> get(@PathVariable UUID id) {
        return ApiResponse.success(categoryService.get(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<McpToolCategoryResponse> update(@PathVariable UUID id,
                                                        @Valid @RequestBody UpdateMcpToolCategoryRequest request) {
        return ApiResponse.success(categoryService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        categoryService.delete(id);
        return ApiResponse.success();
    }
}
