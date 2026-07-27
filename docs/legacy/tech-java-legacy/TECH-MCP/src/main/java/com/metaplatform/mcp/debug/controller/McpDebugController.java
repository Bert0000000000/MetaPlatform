package com.metaplatform.mcp.debug.controller;

import com.metaplatform.mcp.common.ApiResponse;
import com.metaplatform.mcp.common.PageResponse;
import com.metaplatform.mcp.debug.dto.BreakpointResponse;
import com.metaplatform.mcp.debug.dto.CreateBreakpointRequest;
import com.metaplatform.mcp.debug.dto.DebugCompareResponse;
import com.metaplatform.mcp.debug.dto.DebugExecuteRequest;
import com.metaplatform.mcp.debug.dto.DebugSessionResponse;
import com.metaplatform.mcp.debug.service.McpDebugService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/mcp/debug")
@RequiredArgsConstructor
public class McpDebugController {

    private final McpDebugService mcpDebugService;

    @PostMapping("/execute")
    public ApiResponse<DebugSessionResponse> execute(@RequestBody DebugExecuteRequest request) {
        return ApiResponse.success(mcpDebugService.execute(request));
    }

    @GetMapping("/history")
    public ApiResponse<PageResponse<DebugSessionResponse>> history(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return ApiResponse.success(mcpDebugService.history(page, size));
    }

    @GetMapping("/sessions/{id}")
    public ApiResponse<DebugSessionResponse> getSession(@PathVariable UUID id) {
        return ApiResponse.success(mcpDebugService.getSession(id));
    }

    @PostMapping("/sessions/{id}/replay")
    public ApiResponse<DebugSessionResponse> replay(@PathVariable UUID id) {
        return ApiResponse.success(mcpDebugService.replay(id));
    }

    @PostMapping("/compare")
    public ApiResponse<DebugCompareResponse> compare(@RequestBody Map<String, UUID> request) {
        UUID leftId = request.get("leftId");
        UUID rightId = request.get("rightId");
        return ApiResponse.success(mcpDebugService.compare(leftId, rightId));
    }

    @PostMapping("/sessions/{sessionId}/breakpoints")
    public ApiResponse<BreakpointResponse> addBreakpoint(@PathVariable UUID sessionId,
                                                          @RequestBody CreateBreakpointRequest request) {
        return ApiResponse.success(mcpDebugService.addBreakpoint(sessionId, request));
    }

    @DeleteMapping("/sessions/{sessionId}/breakpoints/{breakpointId}")
    public ApiResponse<Void> removeBreakpoint(@PathVariable UUID sessionId,
                                               @PathVariable UUID breakpointId) {
        mcpDebugService.removeBreakpoint(sessionId, breakpointId);
        return ApiResponse.success();
    }

    @GetMapping("/sessions/{sessionId}/breakpoints")
    public ApiResponse<List<BreakpointResponse>> listBreakpoints(@PathVariable UUID sessionId) {
        return ApiResponse.success(mcpDebugService.listBreakpoints(sessionId));
    }
}
