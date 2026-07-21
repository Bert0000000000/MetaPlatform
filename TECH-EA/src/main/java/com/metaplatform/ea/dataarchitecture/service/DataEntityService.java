package com.metaplatform.ea.dataarchitecture.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ea.common.ErrorCode;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.dataarchitecture.dto.CreateDataEntityRequest;
import com.metaplatform.ea.dataarchitecture.dto.DataEntityResponse;
import com.metaplatform.ea.dataarchitecture.dto.DataField;
import com.metaplatform.ea.dataarchitecture.dto.UpdateDataEntityRequest;
import com.metaplatform.ea.dataarchitecture.entity.DataEntityEntity;
import com.metaplatform.ea.dataarchitecture.repository.DataEntityRepository;
import com.metaplatform.ea.exception.EaException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DataEntityService {

    private final DataEntityRepository repository;
    private final ObjectMapper objectMapper;

    @Transactional
    public DataEntityResponse create(CreateDataEntityRequest request) {
        String tenantId = TenantContext.getOrDefault();
        if (repository.existsByTenantIdAndCodeAndDeletedAtIsNull(tenantId, request.getCode())) {
            throw new EaException(ErrorCode.ALREADY_EXISTS,
                    "数据实体编码已存在: " + request.getCode());
        }
        Instant now = Instant.now();
        DataEntityEntity entity = DataEntityEntity.builder()
                .tenantId(tenantId)
                .domainId(request.getDomainId())
                .name(request.getName())
                .code(request.getCode())
                .description(request.getDescription())
                .entityType(request.getEntityType())
                .attributes(toAttributes(request.getFields()))
                .createdAt(now)
                .updatedAt(now)
                .build();
        return toResponse(repository.save(entity));
    }

    @Transactional(readOnly = true)
    public List<DataEntityResponse> list(UUID domainId) {
        String tenantId = TenantContext.getOrDefault();
        List<DataEntityEntity> items = domainId != null
                ? repository.findByDomainIdAndDeletedAtIsNull(domainId)
                : repository.findByTenantIdAndDeletedAtIsNull(tenantId);
        return items.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public DataEntityResponse get(UUID id) {
        return toResponse(findById(id));
    }

    @Transactional
    public DataEntityResponse update(UUID id, UpdateDataEntityRequest request) {
        DataEntityEntity entity = findById(id);
        if (StringUtils.hasText(request.getName())) entity.setName(request.getName());
        if (request.getDescription() != null) entity.setDescription(request.getDescription());
        if (request.getEntityType() != null) entity.setEntityType(request.getEntityType());
        if (request.getFields() != null) entity.setAttributes(toAttributes(request.getFields()));
        if (request.getDomainId() != null) entity.setDomainId(request.getDomainId());
        entity.setUpdatedAt(Instant.now());
        return toResponse(repository.save(entity));
    }

    @Transactional
    public void delete(UUID id) {
        DataEntityEntity entity = findById(id);
        Instant now = Instant.now();
        entity.setDeletedAt(now);
        entity.setUpdatedAt(now);
        repository.save(entity);
    }

    public DataEntityEntity findById(UUID id) {
        String tenantId = TenantContext.getOrDefault();
        return repository.findByIdAndDeletedAtIsNull(id)
                .filter(e -> e.getTenantId().equals(tenantId))
                .orElseThrow(() -> new EaException(ErrorCode.NOT_FOUND, "数据实体不存在"));
    }

    private DataEntityResponse toResponse(DataEntityEntity entity) {
        return DataEntityResponse.builder()
                .id(entity.getId())
                .tenantId(entity.getTenantId())
                .domainId(entity.getDomainId())
                .name(entity.getName())
                .code(entity.getCode())
                .description(entity.getDescription())
                .entityType(entity.getEntityType())
                .fields(fromAttributes(entity.getAttributes()))
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private String toAttributes(List<DataField> fields) {
        try {
            return objectMapper.writeValueAsString(fields != null ? fields : Collections.emptyList());
        } catch (JsonProcessingException e) {
            throw new EaException(ErrorCode.INTERNAL_ERROR, "字段序列化失败: " + e.getMessage());
        }
    }

    private List<DataField> fromAttributes(String attributes) {
        try {
            if (!StringUtils.hasText(attributes)) {
                return Collections.emptyList();
            }
            return objectMapper.readValue(attributes, new TypeReference<List<DataField>>() {});
        } catch (JsonProcessingException e) {
            throw new EaException(ErrorCode.INTERNAL_ERROR, "字段反序列化失败: " + e.getMessage());
        }
    }
}
