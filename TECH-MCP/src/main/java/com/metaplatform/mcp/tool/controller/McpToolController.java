package com.metaplatform.mcp.tool.controller;

import com.metaplatform.mcp.common.ApiResponse;
import com.metaplatform.mcp.common.PageResponse;
import com.metaplatform.mcp.tool.dto.CreateMcpToolRequest;
import com.metaplatform.mcp.tool.dto.McpToolListItem;
import com.metaplatform.mcp.tool.dto.McpToolResponse;
import com.metaplatform.mcp.tool.dto.McpToolVersionCompareResponse;
import com.metaplatform.mcp.tool.dto.McpToolVersionResponse;
import com.metaplatform.mcp.tool.dto.UpdateMcpToolRequest;
import com.metaplatform.mcp.tool.service.McpToolService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
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
            @RequestParam(required = false) String category,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return ApiResponse.success(mcpToolService.list(serverId, toolType, enabled, keyword, category, page, size));
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

    @GetMapping("/{id}/versions")
    public ApiResponse<List<McpToolVersionResponse>> listVersions(@PathVariable UUID id) {
        return ApiResponse.success(mcpToolService.listVersions(id));
    }

    @GetMapping("/{id}/versions/{versionId}")
    public ApiResponse<McpToolVersionResponse> getVersion(@PathVariable UUID id, @PathVariable UUID versionId) {
        return ApiResponse.success(mcpToolService.getVersion(id, versionId));
    }

    @PostMapping("/{id}/versions/{versionId}/rollback")
    public ApiResponse<McpToolVersionResponse> rollback(@PathVariable UUID id, @PathVariable UUID versionId) {
        return ApiResponse.success(mcpToolService.rollback(id, versionId));
    }

    @PostMapping("/{id}/versions/{versionId}/set-current")
    public ApiResponse<McpToolVersionResponse> setCurrent(@PathVariable UUID id, @PathVariable UUID versionId) {
        return ApiResponse.success(mcpToolService.setCurrent(id, versionId));
    }

    @GetMapping("/{id}/versions/compare")
    public ApiResponse<McpToolVersionCompareResponse> compareVersions(
            @PathVariable UUID id,
            @RequestParam UUID leftVersionId,
            @RequestParam UUID rightVersionId) {
        return ApiResponse.success(mcpToolService.compareVersions(id, leftVersionId, rightVersionId));
    }
}
