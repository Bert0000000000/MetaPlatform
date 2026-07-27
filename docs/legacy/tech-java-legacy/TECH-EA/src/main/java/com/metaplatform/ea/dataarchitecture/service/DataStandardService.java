package com.metaplatform.ea.dataarchitecture.service;

import com.metaplatform.ea.common.ErrorCode;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.dataarchitecture.dto.CreateDataStandardRequest;
import com.metaplatform.ea.dataarchitecture.dto.DataStandardResponse;
import com.metaplatform.ea.dataarchitecture.dto.UpdateDataStandardRequest;
import com.metaplatform.ea.dataarchitecture.entity.DataStandardEntity;
import com.metaplatform.ea.dataarchitecture.repository.DataStandardRepository;
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
public class DataStandardService {

    private final DataStandardRepository repository;

    @Transactional
    public DataStandardResponse create(CreateDataStandardRequest request) {
        String tenantId = TenantContext.getOrDefault();
        if (repository.existsByTenantIdAndCodeAndDeletedAtIsNull(tenantId, request.getCode())) {
            throw new EaException(ErrorCode.ALREADY_EXISTS,
                    "数据标准编码已存在: " + request.getCode());
        }
        Instant now = Instant.now();
        DataStandardEntity entity = DataStandardEntity.builder()
                .tenantId(tenantId)
                .code(request.getCode())
                .name(request.getName())
                .standardType(request.getStandardType())
                .rule(request.getRule())
                .description(request.getDescription())
                .createdAt(now)
                .updatedAt(now)
                .build();
        return toResponse(repository.save(entity));
    }

    @Transactional(readOnly = true)
    public List<DataStandardResponse> list() {
        String tenantId = TenantContext.getOrDefault();
        return repository.findByTenantIdAndDeletedAtIsNull(tenantId)
                .stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public DataStandardResponse get(UUID id) {
        return toResponse(findById(id));
    }

    @Transactional
    public DataStandardResponse update(UUID id, UpdateDataStandardRequest request) {
        DataStandardEntity entity = findById(id);
        if (StringUtils.hasText(request.getCode())) {
            if (!entity.getCode().equals(request.getCode())
                    && repository.existsByTenantIdAndCodeAndDeletedAtIsNull(entity.getTenantId(), request.getCode())) {
                throw new EaException(ErrorCode.ALREADY_EXISTS,
                        "数据标准编码已存在: " + request.getCode());
            }
            entity.setCode(request.getCode());
        }
        if (StringUtils.hasText(request.getName())) entity.setName(request.getName());
        if (request.getStandardType() != null) entity.setStandardType(request.getStandardType());
        if (request.getRule() != null) entity.setRule(request.getRule());
        if (request.getDescription() != null) entity.setDescription(request.getDescription());
        entity.setUpdatedAt(Instant.now());
        return toResponse(repository.save(entity));
    }

    @Transactional
    public void delete(UUID id) {
        DataStandardEntity entity = findById(id);
        Instant now = Instant.now();
        entity.setDeletedAt(now);
        entity.setUpdatedAt(now);
        repository.save(entity);
    }

    public DataStandardEntity findById(UUID id) {
        String tenantId = TenantContext.getOrDefault();
        return repository.findByIdAndDeletedAtIsNull(id)
                .filter(e -> e.getTenantId().equals(tenantId))
                .orElseThrow(() -> new EaException(ErrorCode.NOT_FOUND, "数据标准不存在"));
    }

    private DataStandardResponse toResponse(DataStandardEntity entity) {
        return DataStandardResponse.builder()
                .id(entity.getId())
                .tenantId(entity.getTenantId())
                .code(entity.getCode())
                .name(entity.getName())
                .standardType(entity.getStandardType())
                .rule(entity.getRule())
                .description(entity.getDescription())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}
