package com.metaplatform.mcp.external.controller;

import com.metaplatform.mcp.common.ApiResponse;
import com.metaplatform.mcp.common.PageResponse;
import com.metaplatform.mcp.external.dto.CreateExternalAgentRequest;
import com.metaplatform.mcp.external.dto.ExternalAgentResponse;
import com.metaplatform.mcp.external.dto.ExternalAgentTestResult;
import com.metaplatform.mcp.external.dto.UpdateExternalAgentRequest;
import com.metaplatform.mcp.external.service.ExternalAgentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/mcp/external-agents")
@RequiredArgsConstructor
public class ExternalAgentController {

    private final ExternalAgentService externalAgentService;

    @PostMapping
    public ApiResponse<ExternalAgentResponse> create(@Valid @RequestBody CreateExternalAgentRequest request) {
        return ApiResponse.success(externalAgentService.create(request));
    }

    @GetMapping
    public ApiResponse<PageResponse<ExternalAgentResponse>> list(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String trustLevel,
            @RequestParam(required = false) String protocolType,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return ApiResponse.success(externalAgentService.list(status, trustLevel, protocolType, keyword, page, size));
    }

    @GetMapping("/{id}")
    public ApiResponse<ExternalAgentResponse> get(@PathVariable UUID id) {
        return ApiResponse.success(externalAgentService.get(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<ExternalAgentResponse> update(@PathVariable UUID id,
                                                      @Valid @RequestBody UpdateExternalAgentRequest request) {
        return ApiResponse.success(externalAgentService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        externalAgentService.delete(id);
        return ApiResponse.success();
    }

    @PostMapping("/{id}/test-connection")
    public ApiResponse<ExternalAgentTestResult> testConnection(@PathVariable UUID id) {
        return ApiResponse.success(externalAgentService.testConnection(id));
    }
}
