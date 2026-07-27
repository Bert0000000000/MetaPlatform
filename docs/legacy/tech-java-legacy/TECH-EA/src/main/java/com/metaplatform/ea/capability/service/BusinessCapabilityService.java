package com.metaplatform.ea.capability.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ea.capability.dto.*;
import com.metaplatform.ea.capability.entity.BusinessCapabilityEntity;
import com.metaplatform.ea.capability.repository.BusinessCapabilityRepository;
import com.metaplatform.ea.common.ErrorCode;
import com.metaplatform.ea.common.PageResponse;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.exception.EaException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class BusinessCapabilityService {

    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final String STATUS_INACTIVE = "INACTIVE";

    private final BusinessCapabilityRepository capabilityRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public CapabilityResponse create(CreateCapabilityRequest request) {
        String tenantId = TenantContext.getOrDefault();
        if (capabilityRepository.existsByTenantIdAndCodeAndDeletedAtIsNull(tenantId, request.getCode())) {
            throw new EaException(ErrorCode.ALREADY_EXISTS, "能力 code 在该租户下已存在");
        }
        validateJson(request.getMetadata(), "metadata");

        int level = 0;
        if (request.getParentId() != null) {
            BusinessCapabilityEntity parent = findById(request.getParentId());
            level = parent.getLevel() + 1;
        }

        Instant now = Instant.now();
        BusinessCapabilityEntity entity = BusinessCapabilityEntity.builder()
                .tenantId(tenantId)
                .name(request.getName())
                .code(request.getCode())
                .description(request.getDescription())
                .parentId(request.getParentId())
                .level(level)
                .sortOrder(request.getSortOrder() != null ? request.getSortOrder() : 0)
                .status(STATUS_ACTIVE)
                .metadata(normalizeJson(request.getMetadata(), "{}"))
                .createdAt(now)
                .updatedAt(now)
                .build();
        BusinessCapabilityEntity saved = capabilityRepository.save(entity);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public PageResponse<CapabilityResponse> list(String status, String keyword, Integer page, Integer size) {
        String tenantId = TenantContext.getOrDefault();
        int p = page == null || page < 1 ? 1 : page;
        int s = size == null || size < 1 ? 20 : Math.min(size, 100);
        Pageable pageable = PageRequest.of(p - 1, s, Sort.by(Sort.Direction.ASC, "sortOrder").and(Sort.by(Sort.Direction.ASC, "name")));

        Page<BusinessCapabilityEntity> result = capabilityRepository.search(tenantId, status, keyword, pageable);
        return PageResponse.<CapabilityResponse>builder()
                .items(result.getContent().stream().map(this::toResponse).toList())
                .total(result.getTotalElements())
                .page(p)
                .size(s)
                .totalPages(result.getTotalPages())
                .build();
    }

    @Transactional(readOnly = true)
    public CapabilityResponse get(UUID id) {
        return toResponse(findById(id));
    }

    @Transactional
    public CapabilityResponse update(UUID id, UpdateCapabilityRequest request) {
        BusinessCapabilityEntity entity = findById(id);
        if (request.getName() != null) {
            entity.setName(request.getName());
        }
        if (request.getDescription() != null) {
            entity.setDescription(request.getDescription());
        }
        if (request.getSortOrder() != null) {
            entity.setSortOrder(request.getSortOrder());
        }
        if (request.getStatus() != null) {
            validateStatus(request.getStatus());
            entity.setStatus(request.getStatus());
        }
        if (request.getMetadata() != null) {
            validateJson(request.getMetadata(), "metadata");
            entity.setMetadata(normalizeJson(request.getMetadata(), "{}"));
        }
        if (request.getParentId() != null) {
            UUID newParentId = request.getParentId();
            if (newParentId.equals(id)) {
                throw new EaException(ErrorCode.CIRCULAR_REFERENCE, "不能将自身设为父节点");
            }
            BusinessCapabilityEntity newParent = findById(newParentId);
            if (isDescendant(id, newParentId)) {
                throw new EaException(ErrorCode.CIRCULAR_REFERENCE, "不能将子节点设为父节点（循环引用）");
            }
            int oldLevel = entity.getLevel();
            int newLevel = newParent.getLevel() + 1;
            entity.setParentId(newParentId);
            entity.setLevel(newLevel);
            updateDescendantLevels(id, newLevel - oldLevel);
        }
        entity.setUpdatedAt(Instant.now());
        BusinessCapabilityEntity saved = capabilityRepository.save(entity);
        return toResponse(saved);
    }

    @Transactional
    public void delete(UUID id) {
        BusinessCapabilityEntity entity = findById(id);
        Instant now = Instant.now();
        cascadeSoftDelete(id, now);
        entity.setDeletedAt(now);
        entity.setUpdatedAt(now);
        capabilityRepository.save(entity);
    }

    @Transactional(readOnly = true)
    public List<CapabilityTreeNode> getTree() {
        String tenantId = TenantContext.getOrDefault();
        List<BusinessCapabilityEntity> all = capabilityRepository.findByTenantIdAndDeletedAtIsNullOrderBySortOrderAscNameAsc(tenantId);
        return buildTree(all);
    }

    @Transactional(readOnly = true)
    public List<CapabilityResponse> getChildren(UUID id) {
        String tenantId = TenantContext.getOrDefault();
        findById(id);
        return capabilityRepository.findByTenantIdAndParentIdAndDeletedAtIsNullOrderBySortOrderAscNameAsc(tenantId, id)
                .stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<CapabilityResponse> getAncestors(UUID id) {
        BusinessCapabilityEntity entity = findById(id);
        List<CapabilityResponse> ancestors = new ArrayList<>();
        UUID currentParentId = entity.getParentId();
        while (currentParentId != null) {
            BusinessCapabilityEntity parent = capabilityRepository.findByIdAndTenantIdAndDeletedAtIsNull(currentParentId, TenantContext.getOrDefault())
                    .orElse(null);
            if (parent == null) {
                break;
            }
            ancestors.add(toResponse(parent));
            currentParentId = parent.getParentId();
        }
        return ancestors;
    }

    @Transactional
    public CapabilityResponse move(UUID id, MoveCapabilityRequest request) {
        BusinessCapabilityEntity entity = findById(id);
        UUID newParentId = request.getNewParentId();

        if (newParentId != null) {
            if (newParentId.equals(id)) {
                throw new EaException(ErrorCode.CIRCULAR_REFERENCE, "不能将自身设为父节点");
            }
            if (isDescendant(id, newParentId)) {
                throw new EaException(ErrorCode.CIRCULAR_REFERENCE, "不能移动到自身子节点下（循环引用）");
            }
            BusinessCapabilityEntity newParent = findById(newParentId);
            int oldLevel = entity.getLevel();
            int newLevel = newParent.getLevel() + 1;
            entity.setParentId(newParentId);
            entity.setLevel(newLevel);
            updateDescendantLevels(id, newLevel - oldLevel);
        } else {
            int oldLevel = entity.getLevel();
            entity.setParentId(null);
            entity.setLevel(0);
            updateDescendantLevels(id, 0 - oldLevel);
        }
        entity.setUpdatedAt(Instant.now());
        BusinessCapabilityEntity saved = capabilityRepository.save(entity);
        return toResponse(saved);
    }

    public BusinessCapabilityEntity findById(UUID id) {
        String tenantId = TenantContext.getOrDefault();
        return capabilityRepository.findByIdAndTenantIdAndDeletedAtIsNull(id, tenantId)
                .orElseThrow(() -> new EaException(ErrorCode.CAPABILITY_NOT_FOUND, "业务能力不存在"));
    }

    private void cascadeSoftDelete(UUID parentId, Instant now) {
        String tenantId = TenantContext.getOrDefault();
        List<BusinessCapabilityEntity> children = capabilityRepository
                .findByTenantIdAndParentIdAndDeletedAtIsNull(tenantId, parentId);
        for (BusinessCapabilityEntity child : children) {
            cascadeSoftDelete(child.getId(), now);
            child.setDeletedAt(now);
            child.setUpdatedAt(now);
            capabilityRepository.save(child);
        }
    }

    private boolean isDescendant(UUID ancestorId, UUID candidateId) {
        String tenantId = TenantContext.getOrDefault();
        List<BusinessCapabilityEntity> children = capabilityRepository
                .findByTenantIdAndParentIdAndDeletedAtIsNull(tenantId, ancestorId);
        for (BusinessCapabilityEntity child : children) {
            if (child.getId().equals(candidateId)) {
                return true;
            }
            if (isDescendant(child.getId(), candidateId)) {
                return true;
            }
        }
        return false;
    }

    private void updateDescendantLevels(UUID parentId, int delta) {
        String tenantId = TenantContext.getOrDefault();
        List<BusinessCapabilityEntity> children = capabilityRepository
                .findByTenantIdAndParentIdAndDeletedAtIsNull(tenantId, parentId);
        for (BusinessCapabilityEntity child : children) {
            child.setLevel(child.getLevel() + delta);
            child.setUpdatedAt(Instant.now());
            capabilityRepository.save(child);
            updateDescendantLevels(child.getId(), delta);
        }
    }

    private List<CapabilityTreeNode> buildTree(List<BusinessCapabilityEntity> entities) {
        Map<UUID, List<BusinessCapabilityEntity>> byParent = entities.stream()
                .collect(Collectors.groupingBy(e -> e.getParentId() == null ? UUID.randomUUID() : e.getParentId()));

        List<CapabilityTreeNode> roots = new ArrayList<>();
        for (BusinessCapabilityEntity entity : entities) {
            if (entity.getParentId() == null) {
                roots.add(toTreeNode(entity, entities));
            }
        }
        return roots;
    }

    private CapabilityTreeNode toTreeNode(BusinessCapabilityEntity entity, List<BusinessCapabilityEntity> all) {
        List<CapabilityTreeNode> children = all.stream()
                .filter(e -> entity.getId().equals(e.getParentId()))
                .map(e -> toTreeNode(e, all))
                .toList();
        return CapabilityTreeNode.builder()
                .id(entity.getId())
                .name(entity.getName())
                .code(entity.getCode())
                .description(entity.getDescription())
                .parentId(entity.getParentId())
                .level(entity.getLevel())
                .sortOrder(entity.getSortOrder())
                .status(entity.getStatus())
                .children(children)
                .build();
    }

    private CapabilityResponse toResponse(BusinessCapabilityEntity entity) {
        return CapabilityResponse.builder()
                .id(entity.getId())
                .name(entity.getName())
                .code(entity.getCode())
                .description(entity.getDescription())
                .parentId(entity.getParentId())
                .level(entity.getLevel())
                .sortOrder(entity.getSortOrder())
                .status(entity.getStatus())
                .metadata(entity.getMetadata())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private void validateJson(String value, String field) {
        if (value == null || value.isBlank()) {
            return;
        }
        try {
            objectMapper.readTree(value);
        } catch (Exception e) {
            throw new EaException(ErrorCode.INVALID_PARAM, field + " 不是合法的 JSON");
        }
    }

    private String normalizeJson(String value, String defaultValue) {
        if (value == null || value.isBlank()) {
            return defaultValue;
        }
        return value;
    }

    private void validateStatus(String status) {
        if (!STATUS_ACTIVE.equals(status) && !STATUS_INACTIVE.equals(status)) {
            throw new EaException(ErrorCode.INVALID_PARAM, "status 必须为 ACTIVE 或 INACTIVE");
        }
    }
}
