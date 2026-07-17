package com.metaplatform.mcp.server.controller;

import com.metaplatform.mcp.common.ApiResponse;
import com.metaplatform.mcp.common.PageResponse;
import com.metaplatform.mcp.server.dto.CreateMcpServerRequest;
import com.metaplatform.mcp.server.dto.McpServerListItem;
import com.metaplatform.mcp.server.dto.McpServerResponse;
import com.metaplatform.mcp.server.dto.UpdateMcpServerRequest;
import com.metaplatform.mcp.server.service.McpServerService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/mcp/servers")
@RequiredArgsConstructor
public class McpServerController {

    private final McpServerService mcpServerService;

    @PostMapping
    public ApiResponse<McpServerResponse> create(@Valid @RequestBody CreateMcpServerRequest request) {
        return ApiResponse.success(mcpServerService.create(request));
    }

    @GetMapping
    public ApiResponse<PageResponse<McpServerListItem>> list(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return ApiResponse.success(mcpServerService.list(status, keyword, page, size));
    }

    @GetMapping("/{id}")
    public ApiResponse<McpServerResponse> get(@PathVariable UUID id) {
        return ApiResponse.success(mcpServerService.get(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<McpServerResponse> update(@PathVariable UUID id,
                                                   @Valid @RequestBody UpdateMcpServerRequest request) {
        return ApiResponse.success(mcpServerService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        mcpServerService.delete(id);
        return ApiResponse.success();
    }

    @PostMapping("/{id}/start")
    public ApiResponse<McpServerResponse> start(@PathVariable UUID id) {
        return ApiResponse.success(mcpServerService.start(id));
    }

    @PostMapping("/{id}/stop")
    public ApiResponse<McpServerResponse> stop(@PathVariable UUID id) {
        return ApiResponse.success(mcpServerService.stop(id));
    }

    @GetMapping("/{id}/capabilities")
    public ApiResponse<Map<String, Object>> getCapabilities(@PathVariable UUID id) {
        return ApiResponse.success(mcpServerService.getCapabilities(id));
    }
}
