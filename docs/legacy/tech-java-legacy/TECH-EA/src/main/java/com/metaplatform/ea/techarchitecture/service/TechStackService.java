package com.metaplatform.ea.techarchitecture.service;

import com.metaplatform.ea.common.ErrorCode;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.exception.EaException;
import com.metaplatform.ea.techarchitecture.dto.CreateTechStackRequest;
import com.metaplatform.ea.techarchitecture.dto.TechStackResponse;
import com.metaplatform.ea.techarchitecture.dto.UpdateTechStackRequest;
import com.metaplatform.ea.techarchitecture.entity.TechStackEntity;
import com.metaplatform.ea.techarchitecture.repository.TechStackRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TechStackService {

    private final TechStackRepository repository;

    @Transactional
    public TechStackResponse create(CreateTechStackRequest request) {
        String tenantId = TenantContext.getOrDefault();
        if (repository.existsByTenantIdAndCodeAndDeletedAtIsNull(tenantId, request.getCode())) {
            throw new EaException(ErrorCode.ALREADY_EXISTS,
                    "技术栈编码已存在: " + request.getCode());
        }
        Instant now = Instant.now();
        TechStackEntity entity = TechStackEntity.builder()
                .tenantId(tenantId)
                .name(request.getName())
                .code(request.getCode())
                .category(request.getCategory())
                .vendor(request.getVendor())
                .description(request.getDescription())
                .version(request.getVersion())
                .lifecycleStatus(StringUtils.hasText(request.getLifecycleStatus())
                        ? request.getLifecycleStatus().toUpperCase() : "ACTIVE")
                .metadata(request.getMetadata() != null ? request.getMetadata() : "{}")
                .createdAt(now)
                .updatedAt(now)
                .build();
        return toResponse(repository.save(entity));
    }

    @Transactional(readOnly = true)
    public List<TechStackResponse> list() {
        String tenantId = TenantContext.getOrDefault();
        return repository.findByTenantIdAndDeletedAtIsNull(tenantId)
                .stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public TechStackResponse get(UUID id) {
        return toResponse(findById(id));
    }

    @Transactional
    public TechStackResponse update(UUID id, UpdateTechStackRequest request) {
        TechStackEntity entity = findById(id);
        if (StringUtils.hasText(request.getName())) entity.setName(request.getName());
        if (request.getCategory() != null) entity.setCategory(request.getCategory());
        if (request.getVendor() != null) entity.setVendor(request.getVendor());
        if (request.getDescription() != null) entity.setDescription(request.getDescription());
        if (request.getVersion() != null) entity.setVersion(request.getVersion());
        if (StringUtils.hasText(request.getLifecycleStatus())) {
            entity.setLifecycleStatus(request.getLifecycleStatus().toUpperCase());
        }
        if (request.getMetadata() != null) entity.setMetadata(request.getMetadata());
        entity.setUpdatedAt(Instant.now());
        return toResponse(repository.save(entity));
    }

    @Transactional
    public void delete(UUID id) {
        TechStackEntity entity = findById(id);
        Instant now = Instant.now();
        entity.setDeletedAt(now);
        entity.setUpdatedAt(now);
        repository.save(entity);
    }

    public TechStackEntity findById(UUID id) {
        String tenantId = TenantContext.getOrDefault();
        return repository.findByIdAndDeletedAtIsNull(id)
                .filter(e -> e.getTenantId().equals(tenantId))
                .orElseThrow(() -> new EaException(ErrorCode.NOT_FOUND, "技术栈不存在"));
    }

    private TechStackResponse toResponse(TechStackEntity entity) {
        return TechStackResponse.builder()
                .id(entity.getId())
                .tenantId(entity.getTenantId())
                .name(entity.getName())
                .code(entity.getCode())
                .category(entity.getCategory())
                .vendor(entity.getVendor())
                .description(entity.getDescription())
                .version(entity.getVersion())
                .lifecycleStatus(entity.getLifecycleStatus())
                .metadata(entity.getMetadata())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}