package com.metaplatform.ea.role.service;

import com.metaplatform.ea.common.ErrorCode;
import com.metaplatform.ea.common.PageResponse;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.exception.EaException;
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
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class BusinessRoleService {

    private final BusinessRoleRepository roleRepository;

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
                .createdAt(now)
                .updatedAt(now)
                .build();
        BusinessRoleEntity saved = roleRepository.save(entity);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public PageResponse<RoleResponse> list(String keyword, Integer page, Integer size) {
        String tenantId = TenantContext.getOrDefault();
        int p = page == null || page < 1 ? 1 : page;
        int s = size == null || size < 1 ? 20 : Math.min(size, 100);
        Pageable pageable = PageRequest.of(p - 1, s, Sort.by(Sort.Direction.DESC, "updatedAt"));

        Page<BusinessRoleEntity> result = roleRepository.search(tenantId, keyword, pageable);
        return PageResponse.<RoleResponse>builder()
                .items(result.getContent().stream().map(this::toResponse).toList())
                .total(result.getTotalElements())
                .page(p)
                .size(s)
                .totalPages(result.getTotalPages())
                .build();
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
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}
