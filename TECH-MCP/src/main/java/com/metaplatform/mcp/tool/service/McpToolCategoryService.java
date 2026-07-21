package com.metaplatform.mcp.tool.service;

import com.metaplatform.mcp.common.ErrorCode;
import com.metaplatform.mcp.common.TenantContext;
import com.metaplatform.mcp.exception.McpException;
import com.metaplatform.mcp.tool.dto.CreateMcpToolCategoryRequest;
import com.metaplatform.mcp.tool.dto.McpToolCategoryResponse;
import com.metaplatform.mcp.tool.dto.UpdateMcpToolCategoryRequest;
import com.metaplatform.mcp.tool.entity.McpToolCategoryEntity;
import com.metaplatform.mcp.tool.repository.McpToolCategoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class McpToolCategoryService {

    private final McpToolCategoryRepository categoryRepository;

    @Transactional
    public McpToolCategoryResponse create(CreateMcpToolCategoryRequest request) {
        String tenantId = TenantContext.getOrDefault();
        if (categoryRepository.existsByTenantIdAndCodeAndDeletedAtIsNull(tenantId, request.getCode())) {
            throw new McpException(ErrorCode.ALREADY_EXISTS, "分类 code 已存在");
        }
        validateParent(tenantId, request.getParentId());

        Instant now = Instant.now();
        McpToolCategoryEntity entity = McpToolCategoryEntity.builder()
                .tenantId(tenantId)
                .name(request.getName())
                .code(request.getCode())
                .description(request.getDescription())
                .sortOrder(request.getSortOrder() == null ? 0 : request.getSortOrder())
                .parentId(request.getParentId())
                .createdAt(now)
                .updatedAt(now)
                .build();
        return toResponse(categoryRepository.save(entity));
    }

    @Transactional(readOnly = true)
    public List<McpToolCategoryResponse> list() {
        String tenantId = TenantContext.getOrDefault();
        return categoryRepository.findByTenantIdAndDeletedAtIsNullOrderBySortOrderAsc(tenantId)
                .stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public McpToolCategoryResponse get(UUID id) {
        return toResponse(findById(id));
    }

    @Transactional
    public McpToolCategoryResponse update(UUID id, UpdateMcpToolCategoryRequest request) {
        String tenantId = TenantContext.getOrDefault();
        McpToolCategoryEntity entity = findById(id);

        if (request.getName() != null) {
            entity.setName(request.getName());
        }
        if (request.getDescription() != null) {
            entity.setDescription(request.getDescription());
        }
        if (request.getSortOrder() != null) {
            entity.setSortOrder(request.getSortOrder());
        }
        if (request.getParentId() != null) {
            validateParent(tenantId, request.getParentId());
            if (request.getParentId().equals(id)) {
                throw new McpException(ErrorCode.INVALID_PARAM, "不能将自己设为父分类");
            }
            entity.setParentId(request.getParentId());
        }
        entity.setUpdatedAt(Instant.now());
        return toResponse(categoryRepository.save(entity));
    }

    @Transactional
    public void delete(UUID id) {
        McpToolCategoryEntity entity = findById(id);
        entity.setDeletedAt(Instant.now());
        entity.setUpdatedAt(Instant.now());
        categoryRepository.save(entity);
    }

    @Transactional(readOnly = true)
    public McpToolCategoryEntity findById(UUID id) {
        String tenantId = TenantContext.getOrDefault();
        return categoryRepository.findByIdAndTenantIdAndDeletedAtIsNull(id, tenantId)
                .orElseThrow(() -> new McpException(ErrorCode.TOOL_CATEGORY_NOT_FOUND, "工具分类不存在"));
    }

    private void validateParent(String tenantId, UUID parentId) {
        if (parentId == null) {
            return;
        }
        categoryRepository.findByIdAndTenantIdAndDeletedAtIsNull(parentId, tenantId)
                .orElseThrow(() -> new McpException(ErrorCode.TOOL_CATEGORY_NOT_FOUND, "父分类不存在"));
    }

    private McpToolCategoryResponse toResponse(McpToolCategoryEntity entity) {
        return McpToolCategoryResponse.builder()
                .id(entity.getId())
                .name(entity.getName())
                .code(entity.getCode())
                .description(entity.getDescription())
                .sortOrder(entity.getSortOrder())
                .parentId(entity.getParentId())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}
