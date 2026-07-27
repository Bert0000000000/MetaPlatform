package com.metaplatform.mcp.collaboration.service;

import com.metaplatform.mcp.collaboration.dto.CollaborationAuditResponse;
import com.metaplatform.mcp.collaboration.dto.CreateCollaborationAuditRequest;
import com.metaplatform.mcp.collaboration.entity.CollaborationAuditEntity;
import com.metaplatform.mcp.collaboration.repository.CollaborationAuditRepository;
import com.metaplatform.mcp.common.ErrorCode;
import com.metaplatform.mcp.common.PageResponse;
import com.metaplatform.mcp.common.TenantContext;
import com.metaplatform.mcp.exception.McpException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CollaborationAuditService {

    private final CollaborationAuditRepository repository;

    @Transactional
    public CollaborationAuditResponse record(CreateCollaborationAuditRequest request) {
        Instant now = Instant.now();
        CollaborationAuditEntity entity = CollaborationAuditEntity.builder()
                .tenantId(TenantContext.getOrDefault())
                .callerId(request.getCallerId())
                .callerType(normalize(request.getCallerType(), "AGENT"))
                .calleeId(request.getCalleeId())
                .calleeType(normalize(request.getCalleeType(), "AGENT"))
                .operation(request.getOperation())
                .protocolType(normalize(request.getProtocolType(), "MCP"))
                .status(normalize(request.getStatus(), "SUCCESS"))
                .durationMs(request.getDurationMs() == null ? 0L : request.getDurationMs())
                .requestPayload(request.getRequestPayload())
                .responsePayload(request.getResponsePayload())
                .errorMessage(request.getErrorMessage())
                .traceId(request.getTraceId())
                .calledAt(request.getCalledAt() == null ? now : request.getCalledAt())
                .build();
        return toResponse(repository.save(entity));
    }

    @Transactional(readOnly = true)
    public PageResponse<CollaborationAuditResponse> query(String callerId, String calleeId,
                                                           String protocolType, String status,
                                                           Instant startTime, Instant endTime,
                                                           String traceId,
                                                           Integer page, Integer size) {
        String tenantId = TenantContext.getOrDefault();
        int p = page == null || page < 1 ? 1 : page;
        int s = size == null || size < 1 ? 20 : Math.min(size, 100);
        Pageable pageable = PageRequest.of(p - 1, s, Sort.by(Sort.Direction.DESC, "calledAt"));
        Page<CollaborationAuditEntity> result = repository.search(
                tenantId, callerId, calleeId,
                protocolType == null ? null : protocolType.toUpperCase(),
                status == null ? null : status.toUpperCase(),
                startTime, endTime, traceId, pageable);
        return PageResponse.<CollaborationAuditResponse>builder()
                .items(result.getContent().stream().map(this::toResponse).toList())
                .total(result.getTotalElements())
                .page(p)
                .size(s)
                .totalPages(result.getTotalPages())
                .build();
    }

    @Transactional(readOnly = true)
    public CollaborationAuditResponse get(UUID id) {
        String tenantId = TenantContext.getOrDefault();
        return repository.findByIdAndTenantId(id, tenantId)
                .map(this::toResponse)
                .orElseThrow(() -> new McpException(ErrorCode.COLLABORATION_NOT_FOUND, "协作记录不存在"));
    }

    private CollaborationAuditResponse toResponse(CollaborationAuditEntity entity) {
        return CollaborationAuditResponse.builder()
                .id(entity.getId())
                .callerId(entity.getCallerId())
                .callerType(entity.getCallerType())
                .calleeId(entity.getCalleeId())
                .calleeType(entity.getCalleeType())
                .operation(entity.getOperation())
                .protocolType(entity.getProtocolType())
                .status(entity.getStatus())
                .durationMs(entity.getDurationMs())
                .requestPayload(entity.getRequestPayload())
                .responsePayload(entity.getResponsePayload())
                .errorMessage(entity.getErrorMessage())
                .traceId(entity.getTraceId())
                .calledAt(entity.getCalledAt())
                .build();
    }

    private String normalize(String value, String defaultValue) {
        if (value == null || value.isBlank()) {
            return defaultValue;
        }
        return value.toUpperCase();
    }
}
