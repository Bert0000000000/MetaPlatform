package com.metaplatform.ea.governance.review.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ea.common.ErrorCode;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.exception.EaException;
import com.metaplatform.ea.governance.review.dto.CreateReviewTemplateRequest;
import com.metaplatform.ea.governance.review.dto.ReviewTemplateResponse;
import com.metaplatform.ea.governance.review.dto.UpdateReviewTemplateRequest;
import com.metaplatform.ea.governance.review.entity.ReviewTemplateEntity;
import com.metaplatform.ea.governance.review.repository.ReviewTemplateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ReviewTemplateService {

    private final ReviewTemplateRepository repository;
    private final ObjectMapper objectMapper;

    @Transactional
    public ReviewTemplateResponse create(CreateReviewTemplateRequest request) {
        String tenantId = TenantContext.getOrDefault();
        if (repository.existsByTenantIdAndCodeAndDeletedAtIsNull(tenantId, request.getCode())) {
            throw new EaException(ErrorCode.ALREADY_EXISTS, "评审模板编码已存在: " + request.getCode());
        }
        validateJson(request.getMetadata(), "metadata");

        Instant now = Instant.now();
        ReviewTemplateEntity entity = ReviewTemplateEntity.builder()
                .tenantId(tenantId)
                .name(request.getName())
                .code(request.getCode())
                .description(request.getDescription())
                .metadata(normalizeJson(request.getMetadata(), "{}"))
                .createdAt(now)
                .updatedAt(now)
                .build();
        if (request.getDimensions() != null) {
            entity.setDimensions(writeValueAsString(request.getDimensions()));
        }
        if (request.getExperts() != null) {
            entity.setExperts(writeValueAsString(request.getExperts()));
        }
        return toResponse(repository.save(entity));
    }

    @Transactional(readOnly = true)
    public List<ReviewTemplateResponse> list() {
        String tenantId = TenantContext.getOrDefault();
        return repository.findByTenantIdAndDeletedAtIsNull(tenantId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public ReviewTemplateResponse get(UUID id) {
        return toResponse(findById(id));
    }

    @Transactional
    public ReviewTemplateResponse update(UUID id, UpdateReviewTemplateRequest request) {
        ReviewTemplateEntity entity = findById(id);
        if (StringUtils.hasText(request.getName())) entity.setName(request.getName());
        if (StringUtils.hasText(request.getCode())) entity.setCode(request.getCode());
        if (request.getDescription() != null) entity.setDescription(request.getDescription());
        if (request.getDimensions() != null) {
            entity.setDimensions(writeValueAsString(request.getDimensions()));
        }
        if (request.getExperts() != null) {
            entity.setExperts(writeValueAsString(request.getExperts()));
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
        ReviewTemplateEntity entity = findById(id);
        Instant now = Instant.now();
        entity.setDeletedAt(now);
        entity.setUpdatedAt(now);
        repository.save(entity);
    }

    public ReviewTemplateEntity findById(UUID id) {
        String tenantId = TenantContext.getOrDefault();
        return repository.findByIdAndDeletedAtIsNull(id)
                .filter(e -> e.getTenantId().equals(tenantId))
                .orElseThrow(() -> new EaException(ErrorCode.NOT_FOUND, "评审模板不存在"));
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

    private ReviewTemplateResponse toResponse(ReviewTemplateEntity entity) {
        return ReviewTemplateResponse.builder()
                .id(entity.getId())
                .tenantId(entity.getTenantId())
                .name(entity.getName())
                .code(entity.getCode())
                .description(entity.getDescription())
                .dimensions(entity.getDimensions())
                .experts(entity.getExperts())
                .metadata(entity.getMetadata())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}
