package com.metaplatform.mcp.tool.controller;

import com.metaplatform.mcp.common.ApiResponse;
import com.metaplatform.mcp.tool.dto.BatchExecutionItemResponse;
import com.metaplatform.mcp.tool.dto.BatchExecutionRequest;
import com.metaplatform.mcp.tool.dto.ToolExecutionRequest;
import com.metaplatform.mcp.tool.dto.ToolExecutionResponse;
import com.metaplatform.mcp.tool.service.ToolExecutionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/mcp")
@RequiredArgsConstructor
public class ToolExecutionController {

    private final ToolExecutionService toolExecutionService;

    @PostMapping("/tools/{id}/execute")
    public ApiResponse<ToolExecutionResponse> execute(@PathVariable UUID id,
                                                      @RequestBody(required = false) ToolExecutionRequest request) {
        String input = request == null ? null : request.getInput();
        return ApiResponse.success(toolExecutionService.executeTool(id, input));
    }

    @PostMapping("/tools/{id}/async-execute")
    public ApiResponse<Map<String, String>> asyncExecute(@PathVariable UUID id,
                                                         @RequestBody(required = false) ToolExecutionRequest request) {
        String input = request == null ? null : request.getInput();
        UUID executionId = toolExecutionService.asyncExecute(id, input);
        return ApiResponse.success(Map.of("executionId", executionId.toString()));
    }

    @PostMapping("/tools/batch-execute")
    public ApiResponse<Map<String, String>> batchExecute(@Valid @RequestBody BatchExecutionRequest request) {
        String batchId = toolExecutionService.batchExecute(request.getItems());
        return ApiResponse.success(Map.of("batchId", batchId));
    }

    @GetMapping("/executions/{id}")
    public ApiResponse<ToolExecutionResponse> getExecution(@PathVariable UUID id) {
        return ApiResponse.success(toolExecutionService.getExecution(id));
    }

    @GetMapping("/batch-executions/{batchId}")
    public ApiResponse<List<BatchExecutionItemResponse>> getBatchExecutions(@PathVariable String batchId) {
        return ApiResponse.success(toolExecutionService.getBatchExecutions(batchId));
    }
}
