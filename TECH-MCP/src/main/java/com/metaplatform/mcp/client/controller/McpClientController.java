package com.metaplatform.mcp.client.controller;

import com.metaplatform.mcp.client.dto.CreateMcpClientRequest;
import com.metaplatform.mcp.client.dto.McpClientResponse;
import com.metaplatform.mcp.client.dto.UpdateMcpClientRequest;
import com.metaplatform.mcp.client.service.McpClientService;
import com.metaplatform.mcp.common.ApiResponse;
import com.metaplatform.mcp.common.PageResponse;
import com.metaplatform.mcp.tool.dto.McpToolListItem;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/mcp/clients")
@RequiredArgsConstructor
public class McpClientController {

    private final McpClientService mcpClientService;

    @PostMapping
    public ApiResponse<McpClientResponse> create(@Valid @RequestBody CreateMcpClientRequest request) {
        return ApiResponse.success(mcpClientService.create(request));
    }

    @GetMapping
    public ApiResponse<PageResponse<McpClientResponse>> list(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return ApiResponse.success(mcpClientService.list(status, keyword, page, size));
    }

    @GetMapping("/{id}")
    public ApiResponse<McpClientResponse> get(@PathVariable UUID id) {
        return ApiResponse.success(mcpClientService.get(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<McpClientResponse> update(@PathVariable UUID id,
                                                  @Valid @RequestBody UpdateMcpClientRequest request) {
        return ApiResponse.success(mcpClientService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        mcpClientService.delete(id);
        return ApiResponse.success();
    }

    @PostMapping("/{id}/test")
    public ApiResponse<McpClientResponse> testConnection(@PathVariable UUID id) {
        return ApiResponse.success(mcpClientService.testConnection(id));
    }

    @GetMapping("/{id}/status")
    public ApiResponse<Map<String, Object>> getStatus(@PathVariable UUID id) {
        return ApiResponse.success(mcpClientService.getStatus(id));
    }

    @PostMapping("/{id}/discover")
    public ApiResponse<List<McpToolListItem>> discoverTools(@PathVariable UUID id) {
        return ApiResponse.success(mcpClientService.discoverTools(id));
    }

    @GetMapping("/{id}/discovered-tools")
    public ApiResponse<List<McpToolListItem>> getDiscoveredTools(@PathVariable UUID id) {
        return ApiResponse.success(mcpClientService.getDiscoveredTools(id));
    }
}
