package com.metaplatform.ea.governance.principle.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ea.common.ErrorCode;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.exception.EaException;
import com.metaplatform.ea.governance.principle.dto.CreatePrincipleCategoryRequest;
import com.metaplatform.ea.governance.principle.dto.PrincipleCategoryResponse;
import com.metaplatform.ea.governance.principle.dto.UpdatePrincipleCategoryRequest;
import com.metaplatform.ea.governance.principle.entity.PrincipleCategoryEntity;
import com.metaplatform.ea.governance.principle.repository.PrincipleCategoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PrincipleCategoryService {

    private final PrincipleCategoryRepository repository;
    private final ObjectMapper objectMapper;

    @Transactional
    public PrincipleCategoryResponse create(CreatePrincipleCategoryRequest request) {
        String tenantId = TenantContext.getOrDefault();
        if (repository.existsByTenantIdAndCodeAndDeletedAtIsNull(tenantId, request.getCode())) {
            throw new EaException(ErrorCode.ALREADY_EXISTS, "原则分类编码已存在: " + request.getCode());
        }
        validateJson(request.getMetadata(), "metadata");

        Instant now = Instant.now();
        PrincipleCategoryEntity entity = PrincipleCategoryEntity.builder()
                .tenantId(tenantId)
                .name(request.getName())
                .code(request.getCode())
                .parentId(request.getParentId())
                .description(request.getDescription())
                .sortOrder(request.getSortOrder() != null ? request.getSortOrder() : 0)
                .metadata(normalizeJson(request.getMetadata(), "{}"))
                .createdAt(now)
                .updatedAt(now)
                .build();
        return toResponse(repository.save(entity));
    }

    @Transactional(readOnly = true)
    public List<PrincipleCategoryResponse> list() {
        String tenantId = TenantContext.getOrDefault();
        return repository.findByTenantIdAndDeletedAtIsNull(tenantId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public PrincipleCategoryResponse get(UUID id) {
        return toResponse(findById(id));
    }

    @Transactional
    public PrincipleCategoryResponse update(UUID id, UpdatePrincipleCategoryRequest request) {
        PrincipleCategoryEntity entity = findById(id);
        if (StringUtils.hasText(request.getName())) entity.setName(request.getName());
        if (StringUtils.hasText(request.getCode())) entity.setCode(request.getCode());
        if (request.getParentId() != null) entity.setParentId(request.getParentId());
        if (request.getDescription() != null) entity.setDescription(request.getDescription());
        if (request.getSortOrder() != null) entity.setSortOrder(request.getSortOrder());
        if (request.getMetadata() != null) {
            validateJson(request.getMetadata(), "metadata");
            entity.setMetadata(normalizeJson(request.getMetadata(), "{}"));
        }
        entity.setUpdatedAt(Instant.now());
        return toResponse(repository.save(entity));
    }

    @Transactional
    public void delete(UUID id) {
        PrincipleCategoryEntity entity = findById(id);
        Instant now = Instant.now();
        entity.setDeletedAt(now);
        entity.setUpdatedAt(now);
        repository.save(entity);
    }

    public PrincipleCategoryEntity findById(UUID id) {
        String tenantId = TenantContext.getOrDefault();
        return repository.findByIdAndDeletedAtIsNull(id)
                .filter(e -> e.getTenantId().equals(tenantId))
                .orElseThrow(() -> new EaException(ErrorCode.NOT_FOUND, "原则分类不存在"));
    }

    private void validateJson(String value, String field) {
        if (value == null || value.isBlank()) return;
        try {
            objectMapper.readTree(value);
        } catch (Exception e) {
            throw new EaException(ErrorCode.INVALID_PARAM, field + " 不是合法的 JSON");
        }
    }

    private String normalizeJson(String value, String defaultValue) {
        if (value == null || value.isBlank()) return defaultValue;
        return value;
    }

    private PrincipleCategoryResponse toResponse(PrincipleCategoryEntity entity) {
        return PrincipleCategoryResponse.builder()
                .id(entity.getId())
                .tenantId(entity.getTenantId())
                .name(entity.getName())
                .code(entity.getCode())
                .parentId(entity.getParentId())
                .description(entity.getDescription())
                .sortOrder(entity.getSortOrder())
                .metadata(entity.getMetadata())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}
