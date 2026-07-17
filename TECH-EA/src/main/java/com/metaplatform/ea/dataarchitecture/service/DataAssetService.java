package com.metaplatform.ea.dataarchitecture.service;

import com.metaplatform.ea.common.ErrorCode;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.dataarchitecture.dto.CreateDataAssetRequest;
import com.metaplatform.ea.dataarchitecture.dto.DataAssetResponse;
import com.metaplatform.ea.dataarchitecture.dto.UpdateDataAssetRequest;
import com.metaplatform.ea.dataarchitecture.entity.DataAssetEntity;
import com.metaplatform.ea.dataarchitecture.repository.DataAssetRepository;
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
public class DataAssetService {

    private final DataAssetRepository repository;

    @Transactional
    public DataAssetResponse create(CreateDataAssetRequest request) {
        String tenantId = TenantContext.getOrDefault();
        if (repository.existsByTenantIdAndCodeAndDeletedAtIsNull(tenantId, request.getCode())) {
            throw new EaException(ErrorCode.ALREADY_EXISTS,
                    "数据资产编码已存在: " + request.getCode());
        }
        Instant now = Instant.now();
        DataAssetEntity entity = DataAssetEntity.builder()
                .tenantId(tenantId)
                .name(request.getName())
                .code(request.getCode())
                .assetType(request.getAssetType())
                .description(request.getDescription())
                .entityId(request.getEntityId())
                .classification(request.getClassification())
                .metadata(request.getMetadata() != null ? request.getMetadata() : "{}")
                .createdAt(now)
                .updatedAt(now)
                .build();
        return toResponse(repository.save(entity));
    }

    @Transactional(readOnly = true)
    public List<DataAssetResponse> list() {
        String tenantId = TenantContext.getOrDefault();
        return repository.findByTenantIdAndDeletedAtIsNull(tenantId)
                .stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public DataAssetResponse get(UUID id) {
        return toResponse(findById(id));
    }

    @Transactional
    public DataAssetResponse update(UUID id, UpdateDataAssetRequest request) {
        DataAssetEntity entity = findById(id);
        if (StringUtils.hasText(request.getName())) entity.setName(request.getName());
        if (request.getDescription() != null) entity.setDescription(request.getDescription());
        if (request.getEntityId() != null) entity.setEntityId(request.getEntityId());
        if (request.getClassification() != null) entity.setClassification(request.getClassification());
        if (request.getMetadata() != null) entity.setMetadata(request.getMetadata());
        entity.setUpdatedAt(Instant.now());
        return toResponse(repository.save(entity));
    }

    @Transactional
    public void delete(UUID id) {
        DataAssetEntity entity = findById(id);
        Instant now = Instant.now();
        entity.setDeletedAt(now);
        entity.setUpdatedAt(now);
        repository.save(entity);
    }

    public DataAssetEntity findById(UUID id) {
        String tenantId = TenantContext.getOrDefault();
        return repository.findByIdAndDeletedAtIsNull(id)
                .filter(e -> e.getTenantId().equals(tenantId))
                .orElseThrow(() -> new EaException(ErrorCode.NOT_FOUND, "数据资产不存在"));
    }

    private DataAssetResponse toResponse(DataAssetEntity entity) {
        return DataAssetResponse.builder()
                .id(entity.getId())
                .tenantId(entity.getTenantId())
                .name(entity.getName())
                .code(entity.getCode())
                .assetType(entity.getAssetType())
                .description(entity.getDescription())
                .entityId(entity.getEntityId())
                .classification(entity.getClassification())
                .metadata(entity.getMetadata())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}