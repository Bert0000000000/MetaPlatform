package com.metaplatform.mcp.server.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.mcp.common.ErrorCode;
import com.metaplatform.mcp.common.PageResponse;
import com.metaplatform.mcp.common.TenantContext;
import com.metaplatform.mcp.exception.McpException;
import com.metaplatform.mcp.server.dto.CreateMcpServerRequest;
import com.metaplatform.mcp.server.dto.McpServerListItem;
import com.metaplatform.mcp.server.dto.McpServerResponse;
import com.metaplatform.mcp.server.dto.UpdateMcpServerRequest;
import com.metaplatform.mcp.server.entity.McpServerEntity;
import com.metaplatform.mcp.server.repository.McpServerRepository;
import com.metaplatform.mcp.tool.entity.McpToolEntity;
import com.metaplatform.mcp.tool.repository.McpToolRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class McpServerService {

    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final String STATUS_INACTIVE = "INACTIVE";

    private final McpServerRepository mcpServerRepository;
    private final McpToolRepository mcpToolRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public McpServerResponse create(CreateMcpServerRequest request) {
        String tenantId = TenantContext.getOrDefault();
        if (mcpServerRepository.existsByTenantIdAndCodeAndDeletedAtIsNull(tenantId, request.getCode())) {
            throw new McpException(ErrorCode.ALREADY_EXISTS, "MCP Server code 在该租户下已存在");
        }
        validateJson(request.getConfig(), "config");

        Instant now = Instant.now();
        McpServerEntity entity = McpServerEntity.builder()
                .tenantId(tenantId)
                .name(request.getName())
                .code(request.getCode())
                .description(request.getDescription())
                .transportType(request.getTransportType().toUpperCase())
                .endpointUrl(request.getEndpointUrl())
                .status(STATUS_INACTIVE)
                .config(normalizeJson(request.getConfig(), "{}"))
                .createdAt(now)
                .updatedAt(now)
                .build();
        McpServerEntity saved = mcpServerRepository.save(entity);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public PageResponse<McpServerListItem> list(String status, String keyword, Integer page, Integer size) {
        String tenantId = TenantContext.getOrDefault();
        int p = page == null || page < 1 ? 1 : page;
        int s = size == null || size < 1 ? 20 : Math.min(size, 100);
        Pageable pageable = PageRequest.of(p - 1, s, Sort.by(Sort.Direction.DESC, "updatedAt"));

        Page<McpServerEntity> result = mcpServerRepository.search(tenantId, status, keyword, pageable);
        return PageResponse.<McpServerListItem>builder()
                .items(result.getContent().stream().map(this::toListItem).toList())
                .total(result.getTotalElements())
                .page(p)
                .size(s)
                .totalPages(result.getTotalPages())
                .build();
    }

    @Transactional(readOnly = true)
    public McpServerResponse get(UUID id) {
        McpServerEntity entity = findById(id);
        return toResponse(entity);
    }

    @Transactional
    public McpServerResponse update(UUID id, UpdateMcpServerRequest request) {
        McpServerEntity entity = findById(id);
        if (request.getName() != null) {
            entity.setName(request.getName());
        }
        if (request.getDescription() != null) {
            entity.setDescription(request.getDescription());
        }
        if (request.getTransportType() != null) {
            entity.setTransportType(request.getTransportType().toUpperCase());
        }
        if (request.getEndpointUrl() != null) {
            entity.setEndpointUrl(request.getEndpointUrl());
        }
        if (request.getConfig() != null) {
            validateJson(request.getConfig(), "config");
            entity.setConfig(request.getConfig());
        }
        entity.setUpdatedAt(Instant.now());
        McpServerEntity saved = mcpServerRepository.save(entity);
        return toResponse(saved);
    }

    @Transactional
    public void delete(UUID id) {
        McpServerEntity entity = findById(id);
        entity.setDeletedAt(Instant.now());
        entity.setUpdatedAt(Instant.now());
        mcpServerRepository.save(entity);
    }

    @Transactional
    public McpServerResponse start(UUID id) {
        McpServerEntity entity = findById(id);
        if (STATUS_ACTIVE.equals(entity.getStatus())) {
            throw new McpException(ErrorCode.STATE_CONFLICT, "MCP Server 已激活");
        }
        entity.setStatus(STATUS_ACTIVE);
        entity.setUpdatedAt(Instant.now());
        return toResponse(mcpServerRepository.save(entity));
    }

    @Transactional
    public McpServerResponse stop(UUID id) {
        McpServerEntity entity = findById(id);
        if (STATUS_INACTIVE.equals(entity.getStatus())) {
            throw new McpException(ErrorCode.STATE_CONFLICT, "MCP Server 已停用");
        }
        entity.setStatus(STATUS_INACTIVE);
        entity.setUpdatedAt(Instant.now());
        return toResponse(mcpServerRepository.save(entity));
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getCapabilities(UUID id) {
        McpServerEntity entity = findById(id);
        List<McpToolEntity> tools = mcpToolRepository
                .findByTenantIdAndServerIdAndDeletedAtIsNull(entity.getTenantId(), id);
        return Map.of(
                "server", Map.of(
                        "id", entity.getId(),
                        "name", entity.getName(),
                        "code", entity.getCode(),
                        "transportType", entity.getTransportType(),
                        "status", entity.getStatus()
                ),
                "tools", tools.stream().map(t -> Map.of(
                        "id", t.getId(),
                        "name", t.getName(),
                        "code", t.getCode(),
                        "toolType", t.getToolType(),
                        "enabled", t.getEnabled()
                )).toList(),
                "toolCount", tools.size()
        );
    }

    McpServerEntity findById(UUID id) {
        String tenantId = TenantContext.getOrDefault();
        return mcpServerRepository.findByIdAndDeletedAtIsNull(id)
                .filter(e -> e.getTenantId().equals(tenantId))
                .orElseThrow(() -> new McpException(ErrorCode.SERVER_NOT_FOUND, "MCP Server 不存在"));
    }

    private McpServerResponse toResponse(McpServerEntity entity) {
        return McpServerResponse.builder()
                .id(entity.getId())
                .name(entity.getName())
                .code(entity.getCode())
                .description(entity.getDescription())
                .transportType(entity.getTransportType())
                .endpointUrl(entity.getEndpointUrl())
                .status(entity.getStatus())
                .config(entity.getConfig())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private McpServerListItem toListItem(McpServerEntity entity) {
        return McpServerListItem.builder()
                .id(entity.getId())
                .name(entity.getName())
                .code(entity.getCode())
                .transportType(entity.getTransportType())
                .status(entity.getStatus())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private void validateJson(String value, String field) {
        if (value == null || value.isBlank()) {
            return;
        }
        try {
            objectMapper.readTree(value);
        } catch (Exception e) {
            throw new McpException(ErrorCode.INVALID_PARAM, field + " 不是合法的 JSON");
        }
    }

    private String normalizeJson(String value, String defaultValue) {
        if (value == null || value.isBlank()) {
            return defaultValue;
        }
        return value;
    }
}
