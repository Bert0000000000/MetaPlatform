package com.metaplatform.mcp.tool.controller;

import com.metaplatform.mcp.common.ApiResponse;
import com.metaplatform.mcp.common.PageResponse;
import com.metaplatform.mcp.tool.dto.CreateMcpToolRequest;
import com.metaplatform.mcp.tool.dto.McpToolListItem;
import com.metaplatform.mcp.tool.dto.McpToolResponse;
import com.metaplatform.mcp.tool.dto.UpdateMcpToolRequest;
import com.metaplatform.mcp.tool.service.McpToolService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/mcp/tools")
@RequiredArgsConstructor
public class McpToolController {

    private final McpToolService mcpToolService;

    @PostMapping
    public ApiResponse<McpToolResponse> create(@Valid @RequestBody CreateMcpToolRequest request) {
        return ApiResponse.success(mcpToolService.create(request));
    }

    @GetMapping
    public ApiResponse<PageResponse<McpToolListItem>> list(
            @RequestParam(required = false) UUID serverId,
            @RequestParam(required = false) String toolType,
            @RequestParam(required = false) Boolean enabled,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return ApiResponse.success(mcpToolService.list(serverId, toolType, enabled, keyword, page, size));
    }

    @GetMapping("/{id}")
    public ApiResponse<McpToolResponse> get(@PathVariable UUID id) {
        return ApiResponse.success(mcpToolService.get(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<McpToolResponse> update(@PathVariable UUID id,
                                                @Valid @RequestBody UpdateMcpToolRequest request) {
        return ApiResponse.success(mcpToolService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        mcpToolService.delete(id);
        return ApiResponse.success();
    }

    @PostMapping("/{id}/enable")
    public ApiResponse<McpToolResponse> enable(@PathVariable UUID id) {
        return ApiResponse.success(mcpToolService.enable(id));
    }

    @PostMapping("/{id}/disable")
    public ApiResponse<McpToolResponse> disable(@PathVariable UUID id) {
        return ApiResponse.success(mcpToolService.disable(id));
    }
}
