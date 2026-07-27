package com.metaplatform.ea.governance.principle.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ea.common.ErrorCode;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.exception.EaException;
import com.metaplatform.ea.governance.principle.dto.ArchitecturePrincipleResponse;
import com.metaplatform.ea.governance.principle.dto.CreateArchitecturePrincipleRequest;
import com.metaplatform.ea.governance.principle.dto.UpdateArchitecturePrincipleRequest;
import com.metaplatform.ea.governance.principle.entity.ArchitecturePrincipleEntity;
import com.metaplatform.ea.governance.principle.entity.PrincipleCategoryEntity;
import com.metaplatform.ea.governance.principle.repository.ArchitecturePrincipleRepository;
import com.metaplatform.ea.governance.principle.repository.PrincipleCategoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ArchitecturePrincipleService {

    private static final Set<String> ALLOWED_PRIORITIES = Set.of("HIGH", "MEDIUM", "LOW");
    private static final Set<String> ALLOWED_STATUSES = Set.of("ACTIVE", "INACTIVE");

    private final ArchitecturePrincipleRepository repository;
    private final PrincipleCategoryRepository categoryRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public ArchitecturePrincipleResponse create(CreateArchitecturePrincipleRequest request) {
        String tenantId = TenantContext.getOrDefault();
        if (repository.existsByTenantIdAndCodeAndDeletedAtIsNull(tenantId, request.getCode())) {
            throw new EaException(ErrorCode.ALREADY_EXISTS, "架构原则编码已存在: " + request.getCode());
        }
        validateCategory(tenantId, request.getCategoryId());
        validatePriority(request.getPriority());
        validateStatus(request.getStatus());
        validateJson(request.getMetadata(), "metadata");

        Instant now = Instant.now();
        ArchitecturePrincipleEntity entity = ArchitecturePrincipleEntity.builder()
                .tenantId(tenantId)
                .name(request.getName())
                .code(request.getCode())
                .categoryId(request.getCategoryId())
                .description(request.getDescription())
                .priority(normalizePriority(request.getPriority()))
                .status(normalizeStatus(request.getStatus()))
                .metadata(normalizeJson(request.getMetadata(), "{}"))
                .createdAt(now)
                .updatedAt(now)
                .build();
        if (request.getStandards() != null) {
            entity.setStandards(writeValueAsString(request.getStandards()));
        }
        return toResponse(repository.save(entity));
    }

    @Transactional(readOnly = true)
    public List<ArchitecturePrincipleResponse> list(UUID categoryId) {
        String tenantId = TenantContext.getOrDefault();
        List<ArchitecturePrincipleEntity> items;
        if (categoryId != null) {
            items = repository.findByTenantIdAndCategoryIdAndDeletedAtIsNull(tenantId, categoryId);
        } else {
            items = repository.findByTenantIdAndDeletedAtIsNull(tenantId);
        }
        return items.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public ArchitecturePrincipleResponse get(UUID id) {
        return toResponse(findById(id));
    }

    @Transactional
    public ArchitecturePrincipleResponse update(UUID id, UpdateArchitecturePrincipleRequest request) {
        String tenantId = TenantContext.getOrDefault();
        ArchitecturePrincipleEntity entity = findById(id);
        if (StringUtils.hasText(request.getName())) entity.setName(request.getName());
        if (StringUtils.hasText(request.getCode())) entity.setCode(request.getCode());
        if (request.getCategoryId() != null) {
            validateCategory(tenantId, request.getCategoryId());
            entity.setCategoryId(request.getCategoryId());
        }
        if (request.getDescription() != null) entity.setDescription(request.getDescription());
        if (StringUtils.hasText(request.getPriority())) {
            validatePriority(request.getPriority());
            entity.setPriority(request.getPriority().toUpperCase());
        }
        if (StringUtils.hasText(request.getStatus())) {
            validateStatus(request.getStatus());
            entity.setStatus(request.getStatus().toUpperCase());
        }
        if (request.getStandards() != null) {
            entity.setStandards(writeValueAsString(request.getStandards()));
        }
        if (request.getMetadata() != null) {
            validateJson(request.getMetadata(), "metadata");
            entity.setMetadata(normalizeJson(request.getMetadata(), "{}"));
        }
        entity.setUpdatedAt(Instant.now());
        return toResponse(repository.save(entity));
    }

    @Transactional
    public void delete(UUID id) {
        ArchitecturePrincipleEntity entity = findById(id);
        Instant now = Instant.now();
        entity.setDeletedAt(now);
        entity.setUpdatedAt(now);
        repository.save(entity);
    }

    public ArchitecturePrincipleEntity findById(UUID id) {
        String tenantId = TenantContext.getOrDefault();
        return repository.findByIdAndDeletedAtIsNull(id)
                .filter(e -> e.getTenantId().equals(tenantId))
                .orElseThrow(() -> new EaException(ErrorCode.NOT_FOUND, "架构原则不存在"));
    }

    private void validateCategory(String tenantId, UUID categoryId) {
        if (categoryId == null) return;
        PrincipleCategoryEntity category = categoryRepository.findByIdAndDeletedAtIsNull(categoryId)
                .orElseThrow(() -> new EaException(ErrorCode.NOT_FOUND, "原则分类不存在"));
        if (!category.getTenantId().equals(tenantId)) {
            throw new EaException(ErrorCode.PERMISSION_DENIED, "无权访问该原则分类");
        }
    }

    private void validatePriority(String priority) {
        if (priority == null) return;
        if (!ALLOWED_PRIORITIES.contains(priority.toUpperCase())) {
            throw new EaException(ErrorCode.INVALID_PARAM, "priority 必须为 HIGH/MEDIUM/LOW");
        }
    }

    private String normalizePriority(String priority) {
        return priority != null ? priority.toUpperCase() : "MEDIUM";
    }

    private void validateStatus(String status) {
        if (status == null) return;
        if (!ALLOWED_STATUSES.contains(status.toUpperCase())) {
            throw new EaException(ErrorCode.INVALID_PARAM, "status 必须为 ACTIVE/INACTIVE");
        }
    }

    private String normalizeStatus(String status) {
        return status != null ? status.toUpperCase() : "ACTIVE";
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

    private String writeValueAsString(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            throw new EaException(ErrorCode.INTERNAL_ERROR, "JSON 序列化失败: " + e.getMessage());
        }
    }

    private ArchitecturePrincipleResponse toResponse(ArchitecturePrincipleEntity entity) {
        String categoryName = null;
        if (entity.getCategoryId() != null) {
            categoryName = categoryRepository.findByIdAndDeletedAtIsNull(entity.getCategoryId())
                    .map(PrincipleCategoryEntity::getName)
                    .orElse(null);
        }
        return ArchitecturePrincipleResponse.builder()
                .id(entity.getId())
                .tenantId(entity.getTenantId())
                .name(entity.getName())
                .code(entity.getCode())
                .categoryId(entity.getCategoryId())
                .categoryName(categoryName)
                .description(entity.getDescription())
                .priority(entity.getPriority())
                .status(entity.getStatus())
                .standards(entity.getStandards())
                .metadata(entity.getMetadata())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}
