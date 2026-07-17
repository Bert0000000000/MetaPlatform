package com.metaplatform.mcp.tool.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.mcp.common.ErrorCode;
import com.metaplatform.mcp.common.PageResponse;
import com.metaplatform.mcp.common.TenantContext;
import com.metaplatform.mcp.exception.McpException;
import com.metaplatform.mcp.tool.dto.CreateMcpToolRequest;
import com.metaplatform.mcp.tool.dto.McpToolListItem;
import com.metaplatform.mcp.tool.dto.McpToolResponse;
import com.metaplatform.mcp.tool.dto.UpdateMcpToolRequest;
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
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class McpToolService {

    private final McpToolRepository mcpToolRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public McpToolResponse create(CreateMcpToolRequest request) {
        String tenantId = TenantContext.getOrDefault();
        if (mcpToolRepository.existsByTenantIdAndCodeAndDeletedAtIsNull(tenantId, request.getCode())) {
            throw new McpException(ErrorCode.ALREADY_EXISTS, "MCP Tool code 在该租户下已存在");
        }
        validateJson(request.getInputSchema(), "inputSchema");
        validateJson(request.getOutputSchema(), "outputSchema");

        Instant now = Instant.now();
        McpToolEntity entity = McpToolEntity.builder()
                .tenantId(tenantId)
                .serverId(request.getServerId())
                .name(request.getName())
                .code(request.getCode())
                .description(request.getDescription())
                .inputSchema(normalizeJson(request.getInputSchema(), "{}"))
                .outputSchema(normalizeJson(request.getOutputSchema(), "{}"))
                .toolType(request.getToolType().toUpperCase())
                .endpoint(request.getEndpoint())
                .beanClass(request.getBeanClass())
                .enabled(request.getEnabled() == null ? Boolean.TRUE : request.getEnabled())
                .createdAt(now)
                .updatedAt(now)
                .build();
        McpToolEntity saved = mcpToolRepository.save(entity);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public PageResponse<McpToolListItem> list(UUID serverId, String toolType, Boolean enabled,
                                               String keyword, Integer page, Integer size) {
        String tenantId = TenantContext.getOrDefault();
        int p = page == null || page < 1 ? 1 : page;
        int s = size == null || size < 1 ? 20 : Math.min(size, 100);
        Pageable pageable = PageRequest.of(p - 1, s, Sort.by(Sort.Direction.DESC, "updatedAt"));

        List<McpToolEntity> all = mcpToolRepository.search(
                tenantId,
                serverId,
                toolType == null ? null : toolType.toUpperCase(),
                enabled,
                keyword);

        int start = (int) pageable.getOffset();
        int end = Math.min(start + s, all.size());
        List<McpToolListItem> items = (start <= all.size())
                ? all.subList(start, end).stream().map(this::toListItem).toList()
                : List.of();

        return PageResponse.<McpToolListItem>builder()
                .items(items)
                .total(all.size())
                .page(p)
                .size(s)
                .totalPages(all.isEmpty() ? 0 : (int) Math.ceil((double) all.size() / s))
                .build();
    }

    @Transactional(readOnly = true)
    public McpToolResponse get(UUID id) {
        return toResponse(findById(id));
    }

    @Transactional
    public McpToolResponse update(UUID id, UpdateMcpToolRequest request) {
        McpToolEntity entity = findById(id);
        if (request.getName() != null) {
            entity.setName(request.getName());
        }
        if (request.getDescription() != null) {
            entity.setDescription(request.getDescription());
        }
        if (request.getInputSchema() != null) {
            validateJson(request.getInputSchema(), "inputSchema");
            entity.setInputSchema(request.getInputSchema());
        }
        if (request.getOutputSchema() != null) {
            validateJson(request.getOutputSchema(), "outputSchema");
            entity.setOutputSchema(request.getOutputSchema());
        }
        if (request.getToolType() != null) {
            entity.setToolType(request.getToolType().toUpperCase());
        }
        if (request.getEndpoint() != null) {
            entity.setEndpoint(request.getEndpoint());
        }
        if (request.getBeanClass() != null) {
            entity.setBeanClass(request.getBeanClass());
        }
        if (request.getServerId() != null) {
            entity.setServerId(request.getServerId());
        }
        if (request.getEnabled() != null) {
            entity.setEnabled(request.getEnabled());
        }
        entity.setUpdatedAt(Instant.now());
        McpToolEntity saved = mcpToolRepository.save(entity);
        return toResponse(saved);
    }

    @Transactional
    public void delete(UUID id) {
        McpToolEntity entity = findById(id);
        entity.setDeletedAt(Instant.now());
        entity.setUpdatedAt(Instant.now());
        mcpToolRepository.save(entity);
    }

    @Transactional
    public McpToolResponse enable(UUID id) {
        McpToolEntity entity = findById(id);
        if (Boolean.TRUE.equals(entity.getEnabled())) {
            throw new McpException(ErrorCode.STATE_CONFLICT, "Tool 已启用");
        }
        entity.setEnabled(Boolean.TRUE);
        entity.setUpdatedAt(Instant.now());
        return toResponse(mcpToolRepository.save(entity));
    }

    @Transactional
    public McpToolResponse disable(UUID id) {
        McpToolEntity entity = findById(id);
        if (Boolean.FALSE.equals(entity.getEnabled())) {
            throw new McpException(ErrorCode.STATE_CONFLICT, "Tool 已禁用");
        }
        entity.setEnabled(Boolean.FALSE);
        entity.setUpdatedAt(Instant.now());
        return toResponse(mcpToolRepository.save(entity));
    }

    @Transactional(readOnly = true)
    public McpToolEntity findById(UUID id) {
        String tenantId = TenantContext.getOrDefault();
        return mcpToolRepository.findByIdAndDeletedAtIsNull(id)
                .filter(e -> e.getTenantId().equals(tenantId))
                .orElseThrow(() -> new McpException(ErrorCode.TOOL_NOT_FOUND, "MCP Tool 不存在"));
    }

    @Transactional(readOnly = true)
    public McpToolEntity findByCode(String code) {
        String tenantId = TenantContext.getOrDefault();
        return mcpToolRepository.findByTenantIdAndCodeAndDeletedAtIsNull(tenantId, code)
                .orElseThrow(() -> new McpException(ErrorCode.TOOL_NOT_FOUND, "MCP Tool 不存在: " + code));
    }

    @Transactional(readOnly = true)
    public List<McpToolEntity> listEnabled() {
        String tenantId = TenantContext.getOrDefault();
        return mcpToolRepository.findByTenantIdAndEnabledTrueAndDeletedAtIsNull(tenantId);
    }

    private McpToolResponse toResponse(McpToolEntity entity) {
        return McpToolResponse.builder()
                .id(entity.getId())
                .serverId(entity.getServerId())
                .name(entity.getName())
                .code(entity.getCode())
                .description(entity.getDescription())
                .inputSchema(entity.getInputSchema())
                .outputSchema(entity.getOutputSchema())
                .toolType(entity.getToolType())
                .endpoint(entity.getEndpoint())
                .beanClass(entity.getBeanClass())
                .enabled(entity.getEnabled())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private McpToolListItem toListItem(McpToolEntity entity) {
        return McpToolListItem.builder()
                .id(entity.getId())
                .serverId(entity.getServerId())
                .name(entity.getName())
                .code(entity.getCode())
                .toolType(entity.getToolType())
                .enabled(entity.getEnabled())
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
