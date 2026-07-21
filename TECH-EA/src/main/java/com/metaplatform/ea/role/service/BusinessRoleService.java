package com.metaplatform.ea.role.service;

import com.metaplatform.ea.common.ErrorCode;
import com.metaplatform.ea.common.PageResponse;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.exception.EaException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ea.process.repository.BusinessProcessRoleRepository;
import com.metaplatform.ea.role.dto.CreateRoleRequest;
import com.metaplatform.ea.role.dto.RoleResponse;
import com.metaplatform.ea.role.dto.UpdateRoleRequest;
import com.metaplatform.ea.role.entity.BusinessRoleEntity;
import com.metaplatform.ea.role.repository.BusinessRoleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class BusinessRoleService {

    private final BusinessRoleRepository roleRepository;
    private final BusinessProcessRoleRepository processRoleRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public RoleResponse create(CreateRoleRequest request) {
        String tenantId = TenantContext.getOrDefault();
        if (roleRepository.existsByTenantIdAndCodeAndDeletedAtIsNull(tenantId, request.getCode())) {
            throw new EaException(ErrorCode.ALREADY_EXISTS, "角色 code 在该租户下已存在");
        }

        Instant now = Instant.now();
        BusinessRoleEntity entity = BusinessRoleEntity.builder()
                .tenantId(tenantId)
                .name(request.getName())
                .code(request.getCode())
                .description(request.getDescription())
                .responsibility(request.getResponsibility())
                .orgUnitId(request.getOrgUnitId())
                .domain(request.getDomain())
                .iamRoleIds(writeJson(request.getIamRoleIds()))
                .createdAt(now)
                .updatedAt(now)
                .build();
        BusinessRoleEntity saved = roleRepository.save(entity);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public PageResponse<RoleResponse> list(String keyword, UUID orgUnitId, String domain, Integer page, Integer size) {
        String tenantId = TenantContext.getOrDefault();
        int p = page == null || page < 1 ? 1 : page;
        int s = size == null || size < 1 ? 20 : Math.min(size, 100);
        Pageable pageable = PageRequest.of(p - 1, s, Sort.by(Sort.Direction.DESC, "updatedAt"));

        Page<BusinessRoleEntity> result = roleRepository.search(tenantId, keyword, orgUnitId, domain, pageable);
        return PageResponse.<RoleResponse>builder()
                .items(result.getContent().stream().map(this::toResponse).toList())
                .total(result.getTotalElements())
                .page(p)
                .size(s)
                .totalPages(result.getTotalPages())
                .build();
    }

    @Transactional(readOnly = true)
    public List<RoleResponse> listByOrgUnitId(UUID orgUnitId) {
        String tenantId = TenantContext.getOrDefault();
        return roleRepository.findByTenantIdAndOrgUnitIdAndDeletedAtIsNull(tenantId, orgUnitId)
                .stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public RoleResponse get(UUID id) {
        return toResponse(findById(id));
    }

    @Transactional
    public RoleResponse update(UUID id, UpdateRoleRequest request) {
        BusinessRoleEntity entity = findById(id);
        if (request.getName() != null) {
            entity.setName(request.getName());
        }
        if (request.getDescription() != null) {
            entity.setDescription(request.getDescription());
        }
        if (request.getResponsibility() != null) {
            entity.setResponsibility(request.getResponsibility());
        }
        if (request.getOrgUnitId() != null) {
            entity.setOrgUnitId(request.getOrgUnitId());
        }
        if (request.getDomain() != null) {
            entity.setDomain(request.getDomain());
        }
        if (request.getIamRoleIds() != null) {
            entity.setIamRoleIds(writeJson(request.getIamRoleIds()));
        }
        entity.setUpdatedAt(Instant.now());
        BusinessRoleEntity saved = roleRepository.save(entity);
        return toResponse(saved);
    }

    @Transactional
    public void delete(UUID id) {
        BusinessRoleEntity entity = findById(id);
        Instant now = Instant.now();
        entity.setDeletedAt(now);
        entity.setUpdatedAt(now);
        roleRepository.save(entity);
    }

    public BusinessRoleEntity findById(UUID id) {
        String tenantId = TenantContext.getOrDefault();
        return roleRepository.findByIdAndTenantIdAndDeletedAtIsNull(id, tenantId)
                .orElseThrow(() -> new EaException(ErrorCode.ROLE_NOT_FOUND, "业务角色不存在"));
    }

    private RoleResponse toResponse(BusinessRoleEntity entity) {
        return RoleResponse.builder()
                .id(entity.getId())
                .name(entity.getName())
                .code(entity.getCode())
                .description(entity.getDescription())
                .responsibility(entity.getResponsibility())
                .orgUnitId(entity.getOrgUnitId())
                .domain(entity.getDomain())
                .iamRoleIds(readUuidList(entity.getIamRoleIds()))
                .processCount(processRoleRepository.countByRoleId(entity.getId()))
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    @SuppressWarnings("unchecked")
    private List<UUID> readUuidList(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            List<?> list = objectMapper.readValue(json, new TypeReference<List<?>>() {});
            return list.stream()
                    .map(item -> {
                        if (item instanceof String) return UUID.fromString((String) item);
                        return objectMapper.convertValue(item, UUID.class);
                    })
                    .toList();
        } catch (Exception e) {
            return List.of();
        }
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value != null ? value : List.of());
        } catch (Exception e) {
            throw new EaException(ErrorCode.INTERNAL_ERROR, "JSON 序列化失败");
        }
    }
}
