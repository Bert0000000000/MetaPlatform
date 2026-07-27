package com.metaplatform.ea.techarchitecture.service;

import com.metaplatform.ea.common.ErrorCode;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.exception.EaException;
import com.metaplatform.ea.techarchitecture.dto.CreateInfrastructureRequest;
import com.metaplatform.ea.techarchitecture.dto.InfrastructureResponse;
import com.metaplatform.ea.techarchitecture.dto.UpdateInfrastructureRequest;
import com.metaplatform.ea.techarchitecture.entity.InfrastructureEntity;
import com.metaplatform.ea.techarchitecture.repository.InfrastructureRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class InfrastructureService {

    private final InfrastructureRepository repository;

    @Transactional
    public InfrastructureResponse create(CreateInfrastructureRequest request) {
        String tenantId = TenantContext.getOrDefault();
        if (repository.existsByTenantIdAndCodeAndDeletedAtIsNull(tenantId, request.getCode())) {
            throw new EaException(ErrorCode.ALREADY_EXISTS,
                    "基础设施编码已存在: " + request.getCode());
        }
        Instant now = Instant.now();
        InfrastructureEntity entity = InfrastructureEntity.builder()
                .tenantId(tenantId)
                .name(request.getName())
                .code(request.getCode())
                .environment(request.getEnvironment())
                .region(request.getRegion())
                .description(request.getDescription())
                .metadata(request.getMetadata() != null ? request.getMetadata() : "{}")
                .createdAt(now)
                .updatedAt(now)
                .build();
        return toResponse(repository.save(entity));
    }

    @Transactional(readOnly = true)
    public List<InfrastructureResponse> list() {
        String tenantId = TenantContext.getOrDefault();
        return repository.findByTenantIdAndDeletedAtIsNull(tenantId)
                .stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public InfrastructureResponse get(UUID id) {
        return toResponse(findById(id));
    }

    @Transactional
    public InfrastructureResponse update(UUID id, UpdateInfrastructureRequest request) {
        InfrastructureEntity entity = findById(id);
        if (StringUtils.hasText(request.getName())) entity.setName(request.getName());
        if (request.getEnvironment() != null) entity.setEnvironment(request.getEnvironment());
        if (request.getRegion() != null) entity.setRegion(request.getRegion());
        if (request.getDescription() != null) entity.setDescription(request.getDescription());
        if (request.getMetadata() != null) entity.setMetadata(request.getMetadata());
        entity.setUpdatedAt(Instant.now());
        return toResponse(repository.save(entity));
    }

    @Transactional
    public void delete(UUID id) {
        InfrastructureEntity entity = findById(id);
        Instant now = Instant.now();
        entity.setDeletedAt(now);
        entity.setUpdatedAt(now);
        repository.save(entity);
    }

    public InfrastructureEntity findById(UUID id) {
        String tenantId = TenantContext.getOrDefault();
        return repository.findByIdAndDeletedAtIsNull(id)
                .filter(e -> e.getTenantId().equals(tenantId))
                .orElseThrow(() -> new EaException(ErrorCode.NOT_FOUND, "基础设施不存在"));
    }

    private InfrastructureResponse toResponse(InfrastructureEntity entity) {
        return InfrastructureResponse.builder()
                .id(entity.getId())
                .tenantId(entity.getTenantId())
                .name(entity.getName())
                .code(entity.getCode())
                .environment(entity.getEnvironment())
                .region(entity.getRegion())
                .description(entity.getDescription())
                .metadata(entity.getMetadata())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}