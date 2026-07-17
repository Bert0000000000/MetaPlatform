package com.metaplatform.ea.debt.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ea.common.ErrorCode;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.debt.dto.CreateTechStandardRequest;
import com.metaplatform.ea.debt.dto.TechStandardResponse;
import com.metaplatform.ea.debt.dto.UpdateTechStandardRequest;
import com.metaplatform.ea.debt.entity.TechStandardEntity;
import com.metaplatform.ea.debt.repository.TechStandardRepository;
import com.metaplatform.ea.exception.EaException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TechStandardService {

    private final TechStandardRepository repository;
    private final ObjectMapper objectMapper;

    @Transactional
    public TechStandardResponse create(CreateTechStandardRequest request) {
        String tenantId = TenantContext.getOrDefault();
        if (repository.existsByTenantIdAndCodeAndDeletedAtIsNull(tenantId, request.getCode())) {
            throw new EaException(ErrorCode.ALREADY_EXISTS, "技术标准编码已存在: " + request.getCode());
        }
        validateJson(request.getMetadata(), "metadata");

        Instant now = Instant.now();
        TechStandardEntity entity = TechStandardEntity.builder()
                .tenantId(tenantId)
                .name(request.getName())
                .code(request.getCode())
                .category(request.getCategory())
                .version(request.getVersion())
                .description(request.getDescription())
                .mandatory(request.getMandatory() != null ? request.getMandatory() : Boolean.TRUE)
                .metadata(normalizeJson(request.getMetadata(), "{}"))
                .createdAt(now)
                .updatedAt(now)
                .build();
        return toResponse(repository.save(entity));
    }

    @Transactional(readOnly = true)
    public List<TechStandardResponse> list() {
        String tenantId = TenantContext.getOrDefault();
        return repository.findByTenantIdAndDeletedAtIsNull(tenantId)
                .stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public TechStandardResponse get(UUID id) {
        return toResponse(findById(id));
    }

    @Transactional
    public TechStandardResponse update(UUID id, UpdateTechStandardRequest request) {
        TechStandardEntity entity = findById(id);
        if (StringUtils.hasText(request.getName())) entity.setName(request.getName());
        if (request.getCategory() != null) entity.setCategory(request.getCategory());
        if (request.getVersion() != null) entity.setVersion(request.getVersion());
        if (request.getDescription() != null) entity.setDescription(request.getDescription());
        if (request.getMandatory() != null) entity.setMandatory(request.getMandatory());
        if (request.getMetadata() != null) {
            validateJson(request.getMetadata(), "metadata");
            entity.setMetadata(normalizeJson(request.getMetadata(), "{}"));
        }
        entity.setUpdatedAt(Instant.now());
        return toResponse(repository.save(entity));
    }

    @Transactional
    public void delete(UUID id) {
        TechStandardEntity entity = findById(id);
        Instant now = Instant.now();
        entity.setDeletedAt(now);
        entity.setUpdatedAt(now);
        repository.save(entity);
    }

    public TechStandardEntity findById(UUID id) {
        String tenantId = TenantContext.getOrDefault();
        return repository.findByIdAndDeletedAtIsNull(id)
                .filter(e -> e.getTenantId().equals(tenantId))
                .orElseThrow(() -> new EaException(ErrorCode.NOT_FOUND, "技术标准不存在"));
    }

    private void validateJson(String value, String field) {
        if (value == null || value.isBlank()) return;
        try {
            new com.fasterxml.jackson.databind.ObjectMapper().readTree(value);
        } catch (Exception e) {
            throw new EaException(ErrorCode.INVALID_PARAM, field + " 不是合法的 JSON");
        }
    }

    private String normalizeJson(String value, String defaultValue) {
        if (value == null || value.isBlank()) return defaultValue;
        return value;
    }

    private TechStandardResponse toResponse(TechStandardEntity entity) {
        return TechStandardResponse.builder()
                .id(entity.getId())
                .tenantId(entity.getTenantId())
                .name(entity.getName())
                .code(entity.getCode())
                .category(entity.getCategory())
                .version(entity.getVersion())
                .description(entity.getDescription())
                .mandatory(entity.getMandatory())
                .metadata(entity.getMetadata())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}