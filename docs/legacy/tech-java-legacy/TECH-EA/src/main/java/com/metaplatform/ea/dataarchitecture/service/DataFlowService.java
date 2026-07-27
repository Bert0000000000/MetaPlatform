package com.metaplatform.ea.dataarchitecture.service;

import com.metaplatform.ea.common.ErrorCode;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.dataarchitecture.dto.CreateDataFlowRequest;
import com.metaplatform.ea.dataarchitecture.dto.DataFlowResponse;
import com.metaplatform.ea.dataarchitecture.dto.UpdateDataFlowRequest;
import com.metaplatform.ea.dataarchitecture.entity.DataEntityEntity;
import com.metaplatform.ea.dataarchitecture.entity.DataFlowEntity;
import com.metaplatform.ea.dataarchitecture.repository.DataEntityRepository;
import com.metaplatform.ea.dataarchitecture.repository.DataFlowRepository;
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
public class DataFlowService {

    private final DataFlowRepository flowRepository;
    private final DataEntityRepository entityRepository;

    @Transactional
    public DataFlowResponse create(CreateDataFlowRequest request) {
        String tenantId = TenantContext.getOrDefault();
        validateEntities(request.getSourceEntityId(), request.getTargetEntityId());

        Instant now = Instant.now();
        DataFlowEntity entity = DataFlowEntity.builder()
                .tenantId(tenantId)
                .name(request.getName())
                .sourceEntityId(request.getSourceEntityId())
                .targetEntityId(request.getTargetEntityId())
                .flowType(request.getFlowType())
                .description(request.getDescription())
                .schedule(request.getSchedule())
                .createdAt(now)
                .updatedAt(now)
                .build();
        return toResponse(flowRepository.save(entity));
    }

    @Transactional(readOnly = true)
    public List<DataFlowResponse> list() {
        String tenantId = TenantContext.getOrDefault();
        return flowRepository.findByTenantIdAndDeletedAtIsNull(tenantId)
                .stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public DataFlowResponse get(UUID id) {
        return toResponse(findById(id));
    }

    @Transactional
    public DataFlowResponse update(UUID id, UpdateDataFlowRequest request) {
        DataFlowEntity entity = findById(id);
        if (StringUtils.hasText(request.getName())) entity.setName(request.getName());
        if (request.getSourceEntityId() != null || request.getTargetEntityId() != null) {
            UUID sourceId = request.getSourceEntityId() != null ? request.getSourceEntityId() : entity.getSourceEntityId();
            UUID targetId = request.getTargetEntityId() != null ? request.getTargetEntityId() : entity.getTargetEntityId();
            validateEntities(sourceId, targetId);
            entity.setSourceEntityId(sourceId);
            entity.setTargetEntityId(targetId);
        }
        if (request.getFlowType() != null) entity.setFlowType(request.getFlowType());
        if (request.getDescription() != null) entity.setDescription(request.getDescription());
        if (request.getSchedule() != null) entity.setSchedule(request.getSchedule());
        entity.setUpdatedAt(Instant.now());
        return toResponse(flowRepository.save(entity));
    }

    @Transactional
    public void delete(UUID id) {
        DataFlowEntity entity = findById(id);
        Instant now = Instant.now();
        entity.setDeletedAt(now);
        entity.setUpdatedAt(now);
        flowRepository.save(entity);
    }

    public DataFlowEntity findById(UUID id) {
        String tenantId = TenantContext.getOrDefault();
        return flowRepository.findById(id)
                .filter(e -> e.getDeletedAt() == null && e.getTenantId().equals(tenantId))
                .orElseThrow(() -> new EaException(ErrorCode.NOT_FOUND, "数据流不存在"));
    }

    private void validateEntities(UUID sourceEntityId, UUID targetEntityId) {
        entityRepository.findByIdAndDeletedAtIsNull(sourceEntityId)
                .orElseThrow(() -> new EaException(ErrorCode.NOT_FOUND,
                        "源数据实体不存在: " + sourceEntityId));
        entityRepository.findByIdAndDeletedAtIsNull(targetEntityId)
                .orElseThrow(() -> new EaException(ErrorCode.NOT_FOUND,
                        "目标数据实体不存在: " + targetEntityId));
    }

    private DataFlowResponse toResponse(DataFlowEntity entity) {
        return DataFlowResponse.builder()
                .id(entity.getId())
                .tenantId(entity.getTenantId())
                .name(entity.getName())
                .sourceEntityId(entity.getSourceEntityId())
                .targetEntityId(entity.getTargetEntityId())
                .flowType(entity.getFlowType())
                .description(entity.getDescription())
                .schedule(entity.getSchedule())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}
