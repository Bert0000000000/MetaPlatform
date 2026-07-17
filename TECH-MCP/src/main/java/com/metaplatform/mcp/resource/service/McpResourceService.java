package com.metaplatform.mcp.resource.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.mcp.common.ErrorCode;
import com.metaplatform.mcp.common.PageResponse;
import com.metaplatform.mcp.common.TenantContext;
import com.metaplatform.mcp.exception.McpException;
import com.metaplatform.mcp.resource.dto.CreateResourceRequest;
import com.metaplatform.mcp.resource.dto.ResourceListItem;
import com.metaplatform.mcp.resource.dto.ResourceResponse;
import com.metaplatform.mcp.resource.dto.UpdateResourceRequest;
import com.metaplatform.mcp.resource.entity.McpResourceEntity;
import com.metaplatform.mcp.resource.repository.McpResourceRepository;
import lombok.RequiredArgsConstructor;
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
public class McpResourceService {

    private final McpResourceRepository resourceRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public ResourceResponse create(CreateResourceRequest request) {
        String tenantId = TenantContext.getOrDefault();
        if (resourceRepository.existsByTenantIdAndUriAndDeletedAtIsNull(tenantId, request.getUri())) {
            throw new McpException(ErrorCode.ALREADY_EXISTS, "Resource URI 在该租户下已存在");
        }
        validateJson(request.getMetadata(), "metadata");

        Instant now = Instant.now();
        McpResourceEntity entity = McpResourceEntity.builder()
                .tenantId(tenantId)
                .name(request.getName())
                .uri(request.getUri())
                .description(request.getDescription())
                .mimeType(request.getMimeType())
                .content(request.getContent())
                .metadata(normalizeJson(request.getMetadata(), "{}"))
                .relatedConceptId(request.getRelatedConceptId())
                .createdAt(now)
                .updatedAt(now)
                .build();
        McpResourceEntity saved = resourceRepository.save(entity);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public PageResponse<ResourceListItem> list(String conceptId, String keyword,
                                                Integer page, Integer size) {
        String tenantId = TenantContext.getOrDefault();
        int p = page == null || page < 1 ? 1 : page;
        int s = size == null || size < 1 ? 20 : Math.min(size, 100);
        Pageable pageable = PageRequest.of(p - 1, s, Sort.by(Sort.Direction.DESC, "updatedAt"));

        List<McpResourceEntity> all = resourceRepository.search(tenantId, conceptId, keyword);
        int start = (int) pageable.getOffset();
        int end = Math.min(start + s, all.size());
        List<ResourceListItem> items = (start <= all.size())
                ? all.subList(start, end).stream().map(this::toListItem).toList()
                : List.of();

        return PageResponse.<ResourceListItem>builder()
                .items(items)
                .total(all.size())
                .page(p)
                .size(s)
                .totalPages(all.isEmpty() ? 0 : (int) Math.ceil((double) all.size() / s))
                .build();
    }

    @Transactional(readOnly = true)
    public ResourceResponse get(UUID id) {
        return toResponse(findById(id));
    }

    @Transactional(readOnly = true)
    public String readContent(UUID id) {
        McpResourceEntity entity = findById(id);
        return entity.getContent();
    }

    @Transactional(readOnly = true)
    public List<ResourceListItem> findByConcept(String conceptId) {
        String tenantId = TenantContext.getOrDefault();
        return resourceRepository
                .findByTenantIdAndRelatedConceptIdAndDeletedAtIsNull(tenantId, conceptId)
                .stream().map(this::toListItem).toList();
    }

    @Transactional
    public ResourceResponse update(UUID id, UpdateResourceRequest request) {
        McpResourceEntity entity = findById(id);
        if (request.getName() != null) {
            entity.setName(request.getName());
        }
        if (request.getDescription() != null) {
            entity.setDescription(request.getDescription());
        }
        if (request.getMimeType() != null) {
            entity.setMimeType(request.getMimeType());
        }
        if (request.getContent() != null) {
            entity.setContent(request.getContent());
        }
        if (request.getMetadata() != null) {
            validateJson(request.getMetadata(), "metadata");
            entity.setMetadata(request.getMetadata());
        }
        if (request.getRelatedConceptId() != null) {
            entity.setRelatedConceptId(request.getRelatedConceptId());
        }
        entity.setUpdatedAt(Instant.now());
        return toResponse(resourceRepository.save(entity));
    }

    @Transactional
    public void delete(UUID id) {
        McpResourceEntity entity = findById(id);
        entity.setDeletedAt(Instant.now());
        entity.setUpdatedAt(Instant.now());
        resourceRepository.save(entity);
    }

    McpResourceEntity findById(UUID id) {
        String tenantId = TenantContext.getOrDefault();
        return resourceRepository.findByIdAndDeletedAtIsNull(id)
                .filter(e -> e.getTenantId().equals(tenantId))
                .orElseThrow(() -> new McpException(ErrorCode.RESOURCE_NOT_FOUND, "MCP Resource 不存在"));
    }

    private ResourceResponse toResponse(McpResourceEntity entity) {
        return ResourceResponse.builder()
                .id(entity.getId())
                .name(entity.getName())
                .uri(entity.getUri())
                .description(entity.getDescription())
                .mimeType(entity.getMimeType())
                .content(entity.getContent())
                .metadata(entity.getMetadata())
                .relatedConceptId(entity.getRelatedConceptId())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private ResourceListItem toListItem(McpResourceEntity entity) {
        return ResourceListItem.builder()
                .id(entity.getId())
                .name(entity.getName())
                .uri(entity.getUri())
                .mimeType(entity.getMimeType())
                .relatedConceptId(entity.getRelatedConceptId())
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