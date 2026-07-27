package com.metaplatform.mcp.trust.controller;

import com.metaplatform.mcp.common.ApiResponse;
import com.metaplatform.mcp.common.PageResponse;
import com.metaplatform.mcp.trust.dto.CreateTrustRequest;
import com.metaplatform.mcp.trust.dto.TrustResponse;
import com.metaplatform.mcp.trust.dto.UpdateTrustRequest;
import com.metaplatform.mcp.trust.service.AgentTrustService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/mcp/trusts")
@RequiredArgsConstructor
public class AgentTrustController {

    private final AgentTrustService agentTrustService;

    @PostMapping
    public ApiResponse<TrustResponse> create(@Valid @RequestBody CreateTrustRequest request) {
        return ApiResponse.success(agentTrustService.create(request));
    }

    @GetMapping
    public ApiResponse<PageResponse<TrustResponse>> list(
            @RequestParam(required = false) UUID agentId,
            @RequestParam(required = false) String trustLevel,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return ApiResponse.success(agentTrustService.list(agentId, trustLevel, keyword, page, size));
    }

    @GetMapping("/{id}")
    public ApiResponse<TrustResponse> get(@PathVariable UUID id) {
        return ApiResponse.success(agentTrustService.get(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<TrustResponse> update(@PathVariable UUID id,
                                              @Valid @RequestBody UpdateTrustRequest request) {
        return ApiResponse.success(agentTrustService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        agentTrustService.delete(id);
        return ApiResponse.success();
    }
}
