package com.metaplatform.ea.dataarchitecture.service;

import com.metaplatform.ea.common.ErrorCode;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.dataarchitecture.dto.CreateDataDomainRequest;
import com.metaplatform.ea.dataarchitecture.dto.DataDomainResponse;
import com.metaplatform.ea.dataarchitecture.dto.UpdateDataDomainRequest;
import com.metaplatform.ea.dataarchitecture.entity.DataDomainEntity;
import com.metaplatform.ea.dataarchitecture.repository.DataDomainRepository;
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
public class DataDomainService {

    private final DataDomainRepository repository;

    @Transactional
    public DataDomainResponse create(CreateDataDomainRequest request) {
        String tenantId = TenantContext.getOrDefault();
        if (repository.existsByTenantIdAndCodeAndDeletedAtIsNull(tenantId, request.getCode())) {
            throw new EaException(ErrorCode.ALREADY_EXISTS,
                    "数据域编码已存在: " + request.getCode());
        }
        Instant now = Instant.now();
        DataDomainEntity entity = DataDomainEntity.builder()
                .tenantId(tenantId)
                .name(request.getName())
                .code(request.getCode())
                .description(request.getDescription())
                .owner(request.getOwner())
                .metadata(request.getMetadata() != null ? request.getMetadata() : "{}")
                .createdAt(now)
                .updatedAt(now)
                .build();
        return toResponse(repository.save(entity));
    }

    @Transactional(readOnly = true)
    public List<DataDomainResponse> list() {
        String tenantId = TenantContext.getOrDefault();
        return repository.findByTenantIdAndDeletedAtIsNull(tenantId)
                .stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public DataDomainResponse get(UUID id) {
        return toResponse(findById(id));
    }

    @Transactional
    public DataDomainResponse update(UUID id, UpdateDataDomainRequest request) {
        DataDomainEntity entity = findById(id);
        if (StringUtils.hasText(request.getName())) entity.setName(request.getName());
        if (request.getDescription() != null) entity.setDescription(request.getDescription());
        if (request.getOwner() != null) entity.setOwner(request.getOwner());
        if (request.getMetadata() != null) entity.setMetadata(request.getMetadata());
        entity.setUpdatedAt(Instant.now());
        return toResponse(repository.save(entity));
    }

    @Transactional
    public void delete(UUID id) {
        DataDomainEntity entity = findById(id);
        Instant now = Instant.now();
        entity.setDeletedAt(now);
        entity.setUpdatedAt(now);
        repository.save(entity);
    }

    public DataDomainEntity findById(UUID id) {
        String tenantId = TenantContext.getOrDefault();
        return repository.findByIdAndDeletedAtIsNull(id)
                .filter(e -> e.getTenantId().equals(tenantId))
                .orElseThrow(() -> new EaException(ErrorCode.NOT_FOUND, "数据域不存在"));
    }

    private DataDomainResponse toResponse(DataDomainEntity entity) {
        return DataDomainResponse.builder()
                .id(entity.getId())
                .tenantId(entity.getTenantId())
                .name(entity.getName())
                .code(entity.getCode())
                .description(entity.getDescription())
                .owner(entity.getOwner())
                .metadata(entity.getMetadata())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}