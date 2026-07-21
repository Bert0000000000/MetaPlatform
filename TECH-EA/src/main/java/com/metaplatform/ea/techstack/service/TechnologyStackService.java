package com.metaplatform.ea.techstack.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ea.common.ErrorCode;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.exception.EaException;
import com.metaplatform.ea.techstack.dto.CreateTechnologyStackRequest;
import com.metaplatform.ea.techstack.dto.TechnologyStackComponentRef;
import com.metaplatform.ea.techstack.dto.TechnologyStackResponse;
import com.metaplatform.ea.techstack.dto.UpdateTechnologyStackRequest;
import com.metaplatform.ea.techstack.entity.TechnologyStackEntity;
import com.metaplatform.ea.techstack.repository.TechnologyStackRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TechnologyStackService {

    private final TechnologyStackRepository repository;
    private final ObjectMapper objectMapper;

    @Transactional
    public TechnologyStackResponse create(CreateTechnologyStackRequest request) {
        String tenantId = TenantContext.getOrDefault();
        String name = request.getName().trim();
        if (repository.existsByTenantIdAndNameAndDeletedAtIsNull(tenantId, name)) {
            throw new EaException(ErrorCode.ALREADY_EXISTS, "该租户下已存在同名技术栈画像: " + name);
        }
        Instant now = Instant.now();
        TechnologyStackEntity entity = TechnologyStackEntity.builder()
                .tenantId(tenantId)
                .applicationId(request.getApplicationId())
                .name(name)
                .description(request.getDescription())
                .componentRefs(toJson(request.getComponents()))
                .status(StringUtils.hasText(request.getStatus()) ? request.getStatus().toLowerCase() : "active")
                .createdAt(now)
                .updatedAt(now)
                .build();
        return toResponse(repository.save(entity));
    }

    @Transactional(readOnly = true)
    public List<TechnologyStackResponse> list() {
        String tenantId = TenantContext.getOrDefault();
        return repository.findByTenantIdAndDeletedAtIsNull(tenantId).stream()
                .map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public TechnologyStackResponse get(UUID id) {
        return toResponse(findById(id));
    }

    @Transactional
    public TechnologyStackResponse update(UUID id, UpdateTechnologyStackRequest request) {
        TechnologyStackEntity entity = findById(id);
        if (StringUtils.hasText(request.getName())) {
            String newName = request.getName().trim();
            if (!newName.equals(entity.getName())
                    && repository.existsByTenantIdAndNameAndDeletedAtIsNull(entity.getTenantId(), newName)) {
                throw new EaException(ErrorCode.ALREADY_EXISTS, "该租户下已存在同名技术栈画像: " + newName);
            }
            entity.setName(newName);
        }
        if (request.getApplicationId() != null) entity.setApplicationId(request.getApplicationId());
        if (request.getDescription() != null) entity.setDescription(request.getDescription());
        if (request.getComponents() != null) entity.setComponentRefs(toJson(request.getComponents()));
        if (StringUtils.hasText(request.getStatus())) entity.setStatus(request.getStatus().toLowerCase());
        entity.setUpdatedAt(Instant.now());
        return toResponse(repository.save(entity));
    }

    @Transactional
    public void delete(UUID id) {
        TechnologyStackEntity entity = findById(id);
        Instant now = Instant.now();
        entity.setDeletedAt(now);
        entity.setUpdatedAt(now);
        repository.save(entity);
    }

    public TechnologyStackEntity findById(UUID id) {
        String tenantId = TenantContext.getOrDefault();
        return repository.findByIdAndDeletedAtIsNull(id)
                .filter(e -> e.getTenantId().equals(tenantId))
                .orElseThrow(() -> new EaException(ErrorCode.NOT_FOUND, "技术栈画像不存在"));
    }

    private String toJson(List<TechnologyStackComponentRef> components) {
        if (components == null) return "[]";
        try {
            return objectMapper.writeValueAsString(components);
        } catch (JsonProcessingException e) {
            throw new EaException(ErrorCode.INVALID_PARAM, "组件引用序列化失败");
        }
    }

    private List<TechnologyStackComponentRef> fromJson(String json) {
        if (!StringUtils.hasText(json)) return List.of();
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (JsonProcessingException e) {
            throw new EaException(ErrorCode.INTERNAL_ERROR, "组件引用反序列化失败");
        }
    }

    private TechnologyStackResponse toResponse(TechnologyStackEntity entity) {
        return TechnologyStackResponse.builder()
                .id(entity.getId())
                .tenantId(entity.getTenantId())
                .applicationId(entity.getApplicationId())
                .name(entity.getName())
                .description(entity.getDescription())
                .components(fromJson(entity.getComponentRefs()))
                .status(entity.getStatus())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}
