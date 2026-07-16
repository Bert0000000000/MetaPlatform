package com.metaplatform.iam.service;

import com.metaplatform.iam.common.ErrorCode;
import com.metaplatform.iam.common.PageResponse;
import com.metaplatform.iam.dto.role.AssignRolePermissionsRequest;
import com.metaplatform.iam.dto.role.AssignRolePermissionsResponse;
import com.metaplatform.iam.dto.role.CreateRoleRequest;
import com.metaplatform.iam.dto.role.RoleResponse;
import com.metaplatform.iam.dto.role.UpdateRoleRequest;
import com.metaplatform.iam.entity.PermissionEntity;
import com.metaplatform.iam.entity.RoleEntity;
import com.metaplatform.iam.entity.RolePermissionEntity;
import com.metaplatform.iam.exception.IamException;
import com.metaplatform.iam.repository.PermissionRepository;
import com.metaplatform.iam.repository.RolePermissionRepository;
import com.metaplatform.iam.repository.RoleRepository;
import com.metaplatform.iam.security.CurrentUserHolder;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RoleService {

    private final RoleRepository roleRepository;
    private final RolePermissionRepository rolePermissionRepository;
    private final PermissionRepository permissionRepository;

    @Transactional
    public RoleResponse create(CreateRoleRequest request) {
        String tenantId = resolveTenantId(request.getTenantId());
        if (roleRepository.existsByTenantIdAndRoleCodeAndDeletedFalse(tenantId, request.getRoleCode())) {
            throw new IamException(ErrorCode.USER_ALREADY_EXISTS, "角色编码在该租户下已存在");
        }
        String operator = currentOperator();
        RoleEntity entity = RoleEntity.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(tenantId)
                .roleCode(request.getRoleCode())
                .roleName(request.getRoleName())
                .roleType(request.getRoleType() == null ? RoleEntity.RoleType.CUSTOM : request.getRoleType())
                .description(request.getDescription())
                .dataScope(request.getDataScope() == null ? RoleEntity.DataScope.SELF : request.getDataScope())
                .enabled(request.getEnabled() == null ? Boolean.TRUE : request.getEnabled())
                .deleted(false)
                .createdBy(operator)
                .updatedBy(operator)
                .version(1)
                .build();
        RoleEntity saved = roleRepository.save(entity);
        return toResponse(saved, 0L, 0L);
    }

    @Transactional(readOnly = true)
    public PageResponse<RoleResponse> list(String tenantId, String keyword, Integer page, Integer size) {
        String tid = resolveTenantId(tenantId);
        int p = page == null || page < 1 ? 1 : page;
        int s = size == null || size < 1 ? 20 : Math.min(size, 100);
        Pageable pageable = PageRequest.of(p - 1, s, Sort.by(Sort.Direction.ASC, "roleCode"));

        Page<RoleEntity> result;
        if (keyword != null && !keyword.isBlank()) {
            result = roleRepository.searchByKeyword(tid, keyword.trim(), pageable);
        } else {
            result = roleRepository.findByTenantIdAndDeletedFalse(tid, pageable);
        }
        List<RoleResponse> items = result.getContent().stream()
                .map(r -> toResponse(r, rolePermissionRepository.countByRoleIdAndDeletedFalse(r.getId()), 0L))
                .toList();
        return PageResponse.<RoleResponse>builder()
                .items(items)
                .total(result.getTotalElements())
                .page(p)
                .size(s)
                .totalPages(result.getTotalPages())
                .build();
    }

    @Transactional(readOnly = true)
    public RoleResponse get(String id) {
        RoleEntity entity = roleRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new IamException(ErrorCode.NOT_FOUND, "角色不存在"));
        long permCount = rolePermissionRepository.countByRoleIdAndDeletedFalse(id);
        return toResponse(entity, permCount, 0L);
    }

    @Transactional
    public RoleResponse update(String id, UpdateRoleRequest request) {
        RoleEntity entity = roleRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new IamException(ErrorCode.NOT_FOUND, "角色不存在"));
        if (!entity.getVersion().equals(request.getVersion())) {
            throw new IamException(ErrorCode.VERSION_CONFLICT, "角色版本不匹配");
        }
        if (entity.getRoleType() == RoleEntity.RoleType.SYSTEM) {
            // 系统内置角色禁止修改 roleCode
            // 此接口本身不修改 roleCode，但保留业务规则校验
        }
        if (request.getRoleName() != null) {
            entity.setRoleName(request.getRoleName());
        }
        if (request.getDescription() != null) {
            entity.setDescription(request.getDescription());
        }
        if (request.getDataScope() != null) {
            entity.setDataScope(request.getDataScope());
        }
        if (request.getEnabled() != null) {
            entity.setEnabled(request.getEnabled());
        }
        entity.setUpdatedBy(currentOperator());
        RoleEntity saved = roleRepository.save(entity);
        return toResponse(saved, rolePermissionRepository.countByRoleIdAndDeletedFalse(id), 0L);
    }

    @Transactional
    public void softDelete(String id) {
        RoleEntity entity = roleRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new IamException(ErrorCode.NOT_FOUND, "角色不存在"));
        if (entity.getRoleType() == RoleEntity.RoleType.SYSTEM) {
            throw new IamException(ErrorCode.BUSINESS_RULE_VIOLATION, "系统内置角色不可删除");
        }
        long refCount = rolePermissionRepository.countByRoleIdAndDeletedFalse(id);
        if (refCount > 0) {
            rolePermissionRepository.softDeleteByRoleId(id);
        }
        entity.setDeleted(true);
        entity.setDeletedAt(Instant.now());
        entity.setUpdatedBy(currentOperator());
        roleRepository.save(entity);
    }

    @Transactional
    public AssignRolePermissionsResponse assignPermissions(String roleId,
                                                            AssignRolePermissionsRequest request) {
        RoleEntity role = roleRepository.findByIdAndDeletedFalse(roleId)
                .orElseThrow(() -> new IamException(ErrorCode.NOT_FOUND, "角色不存在"));
        if (role.getRoleType() == RoleEntity.RoleType.SYSTEM) {
            throw new IamException(ErrorCode.BUSINESS_RULE_VIOLATION, "系统内置角色不可修改权限");
        }
        List<PermissionEntity> permissions = permissionRepository.findAllById(request.getPermissionIds());
        if (permissions.size() != request.getPermissionIds().size()) {
            throw new IamException(ErrorCode.NOT_FOUND, "部分 permissionId 不存在");
        }
        boolean replace = Boolean.TRUE.equals(request.getReplaceMode());
        String operator = currentOperator();
        if (replace) {
            rolePermissionRepository.softDeleteByRoleId(roleId);
        }
        Set<String> existing = rolePermissionRepository.findByRoleIdAndDeletedFalse(roleId).stream()
                .map(RolePermissionEntity::getPermissionId)
                .collect(Collectors.toSet());
        List<RolePermissionEntity> toCreate = new ArrayList<>();
        for (PermissionEntity p : permissions) {
            if (existing.contains(p.getId())) {
                continue;
            }
            toCreate.add(RolePermissionEntity.builder()
                    .id(UUID.randomUUID().toString())
                    .tenantId(role.getTenantId())
                    .roleId(role.getId())
                    .permissionId(p.getId())
                    .deleted(false)
                    .createdBy(operator)
                    .updatedBy(operator)
                    .version(1)
                    .build());
        }
        if (!toCreate.isEmpty()) {
            rolePermissionRepository.saveAll(toCreate);
        }
        Map<String, String> codeById = permissions.stream()
                .collect(Collectors.toMap(PermissionEntity::getId, PermissionEntity::getPermissionCode));
        Set<String> allPermIds = new HashSet<>(existing);
        allPermIds.addAll(permissions.stream().map(PermissionEntity::getId).toList());
        List<AssignRolePermissionsResponse.AssignedPermission> assigned = allPermIds.stream()
                .map(pid -> AssignRolePermissionsResponse.AssignedPermission.builder()
                        .permissionId(pid)
                        .permissionCode(codeById.getOrDefault(pid, null))
                        .build())
                .toList();
        role.setUpdatedBy(operator);
        roleRepository.save(role);
        return AssignRolePermissionsResponse.builder()
                .roleId(role.getId())
                .roleCode(role.getRoleCode())
                .permissionCount(assigned.size())
                .assignedPermissions(assigned)
                .updatedAt(role.getUpdatedAt())
                .updatedBy(operator)
                .build();
    }

    @Transactional(readOnly = true)
    public List<PermissionEntity> listPermissionsOfRole(String roleId) {
        if (!roleRepository.existsById(roleId)) {
            throw new IamException(ErrorCode.NOT_FOUND, "角色不存在");
        }
        List<RolePermissionEntity> links = rolePermissionRepository.findByRoleIdAndDeletedFalse(roleId);
        if (links.isEmpty()) {
            return List.of();
        }
        List<String> permissionIds = links.stream().map(RolePermissionEntity::getPermissionId).toList();
        return permissionRepository.findAllById(permissionIds);
    }

    private RoleResponse toResponse(RoleEntity r, Long permissionCount, Long memberCount) {
        return RoleResponse.builder()
                .roleId(r.getId())
                .roleCode(r.getRoleCode())
                .roleName(r.getRoleName())
                .roleType(r.getRoleType())
                .description(r.getDescription())
                .dataScope(r.getDataScope())
                .enabled(r.getEnabled())
                .version(r.getVersion())
                .permissionCount(permissionCount == null ? 0L : permissionCount)
                .memberCount(memberCount == null ? 0L : memberCount)
                .createdAt(r.getCreatedAt())
                .updatedAt(r.getUpdatedAt())
                .createdBy(r.getCreatedBy())
                .updatedBy(r.getUpdatedBy())
                .build();
    }

    private String resolveTenantId(String requestTenantId) {
        return (requestTenantId == null || requestTenantId.isBlank()) ? "tenant-default" : requestTenantId;
    }

    private String currentOperator() {
        try {
            return CurrentUserHolder.requireUserId();
        } catch (IamException ex) {
            return "system";
        }
    }
}