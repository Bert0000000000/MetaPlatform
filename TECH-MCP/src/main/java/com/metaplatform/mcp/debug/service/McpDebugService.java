package com.metaplatform.mcp.debug.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.mcp.common.ErrorCode;
import com.metaplatform.mcp.common.PageResponse;
import com.metaplatform.mcp.common.TenantContext;
import com.metaplatform.mcp.common.TraceContext;
import com.metaplatform.mcp.debug.dto.DebugCompareResponse;
import com.metaplatform.mcp.debug.dto.DebugExecuteRequest;
import com.metaplatform.mcp.debug.dto.DebugSessionResponse;
import com.metaplatform.mcp.debug.entity.McpDebugSessionEntity;
import com.metaplatform.mcp.debug.repository.McpDebugSessionRepository;
import com.metaplatform.mcp.exception.McpException;
import com.metaplatform.mcp.jsonrpc.JsonRpcController;
import com.metaplatform.mcp.jsonrpc.JsonRpcRequest;
import com.metaplatform.mcp.jsonrpc.JsonRpcResponse;
import com.metaplatform.mcp.server.entity.McpServerEntity;
import com.metaplatform.mcp.server.repository.McpServerRepository;
import com.metaplatform.mcp.tool.entity.McpToolEntity;
import com.metaplatform.mcp.tool.repository.McpToolRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class McpDebugService {

    private static final String STATUS_SUCCESS = "SUCCESS";
    private static final String STATUS_FAILED = "FAILED";
    private static final String STATUS_BREAKPOINT = "BREAKPOINT";

    private final McpDebugSessionRepository debugSessionRepository;
    private final McpToolRepository toolRepository;
    private final McpServerRepository serverRepository;
    private final JsonRpcController jsonRpcController;
    private final ObjectMapper objectMapper;

    @Transactional
    public DebugSessionResponse execute(DebugExecuteRequest request) {
        String tenantId = TenantContext.getOrDefault();
        String traceId = TraceContext.getOrCreate();
        Instant now = Instant.now();

        validateResources(request, tenantId);

        String rawRequest = serialize(request.getRequestPayload());
        String method = extractMethod(request.getRequestPayload());

        McpDebugSessionEntity.McpDebugSessionEntityBuilder entityBuilder = McpDebugSessionEntity.builder()
                .tenantId(tenantId)
                .serverId(request.getServerId())
                .toolId(request.getToolId())
                .method(method)
                .requestPayload(rawRequest)
                .rawRequest(rawRequest)
                .breakpoint(request.isBreakpoint())
                .traceId(traceId)
                .createdAt(now)
                .updatedAt(now);

        if (request.isBreakpoint()) {
            entityBuilder.status(STATUS_BREAKPOINT);
            return toResponse(debugSessionRepository.save(entityBuilder.build()));
        }

        Instant started = Instant.now();
        JsonRpcResponse rpcResponse = invoke(request.getRequestPayload());
        long durationMs = Duration.between(started, Instant.now()).toMillis();

        String rawResponse = serialize(rpcResponse);
        String status = rpcResponse.getError() == null ? STATUS_SUCCESS : STATUS_FAILED;
        String errorMessage = rpcResponse.getError() == null ? null : rpcResponse.getError().getMessage();

        McpDebugSessionEntity entity = entityBuilder
                .responsePayload(rawResponse)
                .rawResponse(rawResponse)
                .durationMs(durationMs)
                .status(status)
                .errorMessage(errorMessage)
                .build();
        return toResponse(debugSessionRepository.save(entity));
    }

    @Transactional(readOnly = true)
    public PageResponse<DebugSessionResponse> history(Integer page, Integer size) {
        String tenantId = TenantContext.getOrDefault();
        int p = page == null || page < 1 ? 1 : page;
        int s = size == null || size < 1 ? 20 : Math.min(size, 100);
        Pageable pageable = PageRequest.of(p - 1, s, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<McpDebugSessionEntity> result = debugSessionRepository.findByTenantIdOrderByCreatedAtDesc(tenantId, pageable);
        return PageResponse.<DebugSessionResponse>builder()
                .items(result.getContent().stream().map(this::toResponse).toList())
                .total(result.getTotalElements())
                .page(p)
                .size(s)
                .totalPages(result.getTotalPages())
                .build();
    }

    @Transactional(readOnly = true)
    public DebugSessionResponse getSession(UUID id) {
        String tenantId = TenantContext.getOrDefault();
        McpDebugSessionEntity entity = debugSessionRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new McpException(ErrorCode.DEBUG_SESSION_NOT_FOUND, "调试会话不存在"));
        return toResponse(entity);
    }

    @Transactional
    public DebugSessionResponse replay(UUID id) {
        String tenantId = TenantContext.getOrDefault();
        McpDebugSessionEntity original = debugSessionRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new McpException(ErrorCode.DEBUG_SESSION_NOT_FOUND, "调试会话不存在"));
        Map<String, Object> payload = parse(original.getRequestPayload());
        DebugExecuteRequest replayRequest = new DebugExecuteRequest();
        replayRequest.setServerId(original.getServerId());
        replayRequest.setToolId(original.getToolId());
        replayRequest.setRequestPayload(payload);
        replayRequest.setBreakpoint(false);
        return execute(replayRequest);
    }

    @Transactional(readOnly = true)
    public DebugCompareResponse compare(UUID leftId, UUID rightId) {
        String tenantId = TenantContext.getOrDefault();
        McpDebugSessionEntity left = debugSessionRepository.findByIdAndTenantId(leftId, tenantId)
                .orElseThrow(() -> new McpException(ErrorCode.DEBUG_SESSION_NOT_FOUND, "左侧调试会话不存在"));
        McpDebugSessionEntity right = debugSessionRepository.findByIdAndTenantId(rightId, tenantId)
                .orElseThrow(() -> new McpException(ErrorCode.DEBUG_SESSION_NOT_FOUND, "右侧调试会话不存在"));
        return DebugCompareResponse.builder()
                .left(toResponse(left))
                .right(toResponse(right))
                .differences(computeDifferences(left, right))
                .build();
    }

    private void validateResources(DebugExecuteRequest request, String tenantId) {
        if (request.getToolId() != null) {
            McpToolEntity tool = toolRepository.findByIdAndDeletedAtIsNull(request.getToolId())
                    .orElseThrow(() -> new McpException(ErrorCode.TOOL_NOT_FOUND, "MCP Tool 不存在"));
            if (!tenantId.equals(tool.getTenantId())) {
                throw new McpException(ErrorCode.TOOL_NOT_FOUND, "MCP Tool 不存在");
            }
        }
        if (request.getServerId() != null) {
            McpServerEntity server = serverRepository.findByIdAndDeletedAtIsNull(request.getServerId())
                    .orElseThrow(() -> new McpException(ErrorCode.SERVER_NOT_FOUND, "MCP Server 不存在"));
            if (!tenantId.equals(server.getTenantId())) {
                throw new McpException(ErrorCode.SERVER_NOT_FOUND, "MCP Server 不存在");
            }
        }
    }

    private JsonRpcResponse invoke(Map<String, Object> payload) {
        JsonRpcRequest rpcRequest = objectMapper.convertValue(payload, JsonRpcRequest.class);
        return jsonRpcController.handle(rpcRequest);
    }

    private String extractMethod(Map<String, Object> payload) {
        if (payload == null) {
            return null;
        }
        Object method = payload.get("method");
        return method == null ? null : method.toString();
    }

    private String serialize(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            log.warn("Failed to serialize debug value", e);
            return value.toString();
        }
    }

    private Map<String, Object> parse(String json) {
        if (json == null || json.isBlank()) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {
            });
        } catch (Exception e) {
            log.warn("Failed to parse debug payload", e);
            return Map.of();
        }
    }

    private List<String> computeDifferences(McpDebugSessionEntity left, McpDebugSessionEntity right) {
        List<String> diffs = new ArrayList<>();
        if (!Objects.equals(left.getMethod(), right.getMethod())) {
            diffs.add("method");
        }
        if (!Objects.equals(left.getRequestPayload(), right.getRequestPayload())) {
            diffs.add("requestPayload");
        }
        if (!Objects.equals(left.getResponsePayload(), right.getResponsePayload())) {
            diffs.add("responsePayload");
        }
        if (!Objects.equals(left.getStatus(), right.getStatus())) {
            diffs.add("status");
        }
        if (!Objects.equals(left.getDurationMs(), right.getDurationMs())) {
            diffs.add("durationMs");
        }
        return diffs;
    }

    private DebugSessionResponse toResponse(McpDebugSessionEntity entity) {
        return DebugSessionResponse.builder()
                .id(entity.getId())
                .serverId(entity.getServerId())
                .toolId(entity.getToolId())
                .method(entity.getMethod())
                .requestPayload(parse(entity.getRequestPayload()))
                .responsePayload(parse(entity.getResponsePayload()))
                .rawRequest(entity.getRawRequest())
                .rawResponse(entity.getRawResponse())
                .durationMs(entity.getDurationMs())
                .status(entity.getStatus())
                .errorMessage(entity.getErrorMessage())
                .breakpoint(entity.getBreakpoint())
                .traceId(entity.getTraceId())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}
