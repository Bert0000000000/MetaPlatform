package com.metaplatform.ea.techcomponent.service;

import com.metaplatform.ea.common.ErrorCode;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.exception.EaException;
import com.metaplatform.ea.techcomponent.dto.CreateTechnologyComponentRequest;
import com.metaplatform.ea.techcomponent.dto.TechnologyComponentResponse;
import com.metaplatform.ea.techcomponent.dto.UpdateTechnologyComponentRequest;
import com.metaplatform.ea.techcomponent.entity.TechnologyComponentEntity;
import com.metaplatform.ea.techcomponent.repository.TechnologyComponentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TechnologyComponentService {

    private final TechnologyComponentRepository repository;

    @Transactional
    public TechnologyComponentResponse create(CreateTechnologyComponentRequest request) {
        String tenantId = TenantContext.getOrDefault();
        String name = request.getName().trim();
        String type = request.getType().trim();
        if (repository.existsByTenantIdAndNameAndTypeAndDeletedAtIsNull(tenantId, name, type)) {
            throw new EaException(ErrorCode.ALREADY_EXISTS,
                    "该租户下已存在同名同类型的技术组件: " + name + " / " + type);
        }
        Instant now = Instant.now();
        TechnologyComponentEntity entity = TechnologyComponentEntity.builder()
                .tenantId(tenantId)
                .name(name)
                .type(type)
                .version(request.getVersion())
                .description(request.getDescription())
                .owner(request.getOwner())
                .status(StringUtils.hasText(request.getStatus()) ? request.getStatus().toLowerCase() : "active")
                .createdAt(now)
                .updatedAt(now)
                .build();
        return toResponse(repository.save(entity));
    }

    @Transactional(readOnly = true)
    public List<TechnologyComponentResponse> list() {
        String tenantId = TenantContext.getOrDefault();
        return repository.findByTenantIdAndDeletedAtIsNull(tenantId).stream()
                .map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<TechnologyComponentResponse> listByType(String type) {
        String tenantId = TenantContext.getOrDefault();
        return repository.findByTenantIdAndTypeAndDeletedAtIsNull(tenantId, type).stream()
                .map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public TechnologyComponentResponse get(UUID id) {
        return toResponse(findById(id));
    }

    @Transactional
    public TechnologyComponentResponse update(UUID id, UpdateTechnologyComponentRequest request) {
        TechnologyComponentEntity entity = findById(id);
        String newName = request.getName() != null ? request.getName().trim() : null;
        String newType = request.getType() != null ? request.getType().trim() : null;
        if (newName != null && newType != null
                && (!newName.equals(entity.getName()) || !newType.equals(entity.getType()))
                && repository.existsByTenantIdAndNameAndTypeAndDeletedAtIsNull(entity.getTenantId(), newName, newType)) {
            throw new EaException(ErrorCode.ALREADY_EXISTS,
                    "该租户下已存在同名同类型的技术组件: " + newName + " / " + newType);
        }
        if (newName != null) entity.setName(newName);
        if (newType != null) entity.setType(newType);
        if (request.getVersion() != null) entity.setVersion(request.getVersion());
        if (request.getDescription() != null) entity.setDescription(request.getDescription());
        if (request.getOwner() != null) entity.setOwner(request.getOwner());
        if (StringUtils.hasText(request.getStatus())) entity.setStatus(request.getStatus().toLowerCase());
        entity.setUpdatedAt(Instant.now());
        return toResponse(repository.save(entity));
    }

    @Transactional
    public void delete(UUID id) {
        TechnologyComponentEntity entity = findById(id);
        Instant now = Instant.now();
        entity.setDeletedAt(now);
        entity.setUpdatedAt(now);
        repository.save(entity);
    }

    public TechnologyComponentEntity findById(UUID id) {
        String tenantId = TenantContext.getOrDefault();
        return repository.findByIdAndDeletedAtIsNull(id)
                .filter(e -> e.getTenantId().equals(tenantId))
                .orElseThrow(() -> new EaException(ErrorCode.NOT_FOUND, "技术组件不存在"));
    }

    private TechnologyComponentResponse toResponse(TechnologyComponentEntity entity) {
        return TechnologyComponentResponse.builder()
                .id(entity.getId())
                .tenantId(entity.getTenantId())
                .name(entity.getName())
                .type(entity.getType())
                .version(entity.getVersion())
                .description(entity.getDescription())
                .owner(entity.getOwner())
                .status(entity.getStatus())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}
