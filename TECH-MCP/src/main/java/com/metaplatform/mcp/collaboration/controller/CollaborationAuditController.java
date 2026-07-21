package com.metaplatform.mcp.collaboration.controller;

import com.metaplatform.mcp.collaboration.dto.CollaborationAuditResponse;
import com.metaplatform.mcp.collaboration.dto.CreateCollaborationAuditRequest;
import com.metaplatform.mcp.collaboration.service.CollaborationAuditService;
import com.metaplatform.mcp.common.ApiResponse;
import com.metaplatform.mcp.common.PageResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/mcp/collaborations")
@RequiredArgsConstructor
public class CollaborationAuditController {

    private final CollaborationAuditService collaborationAuditService;

    @PostMapping
    public ApiResponse<CollaborationAuditResponse> record(@Valid @RequestBody CreateCollaborationAuditRequest request) {
        return ApiResponse.success(collaborationAuditService.record(request));
    }

    @GetMapping("/logs")
    public ApiResponse<PageResponse<CollaborationAuditResponse>> list(
            @RequestParam(required = false) String callerId,
            @RequestParam(required = false) String calleeId,
            @RequestParam(required = false) String protocolType,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Instant startTime,
            @RequestParam(required = false) Instant endTime,
            @RequestParam(required = false) String traceId,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return ApiResponse.success(collaborationAuditService.query(
                callerId, calleeId, protocolType, status, startTime, endTime, traceId, page, size));
    }

    @GetMapping("/logs/{id}")
    public ApiResponse<CollaborationAuditResponse> get(@PathVariable UUID id) {
        return ApiResponse.success(collaborationAuditService.get(id));
    }
}
