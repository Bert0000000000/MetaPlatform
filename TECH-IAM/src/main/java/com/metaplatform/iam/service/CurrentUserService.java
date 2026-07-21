package com.metaplatform.iam.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.iam.common.ErrorCode;
import com.metaplatform.iam.dto.auth.CurrentUserResponse;
import com.metaplatform.iam.dto.auth.UserPermissionsResponse;
import com.metaplatform.iam.entity.PermissionEntity;
import com.metaplatform.iam.entity.RoleEntity;
import com.metaplatform.iam.entity.RolePermissionEntity;
import com.metaplatform.iam.entity.UserEntity;
import com.metaplatform.iam.entity.UserRoleEntity;
import com.metaplatform.iam.exception.IamException;
import com.metaplatform.iam.repository.PermissionRepository;
import com.metaplatform.iam.repository.RolePermissionRepository;
import com.metaplatform.iam.repository.RoleRepository;
import com.metaplatform.iam.repository.UserRepository;
import com.metaplatform.iam.repository.UserRoleRepository;
import com.metaplatform.iam.security.CurrentUserHolder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class CurrentUserService {

    private final UserRepository userRepository;
    private final UserDepartmentService userDepartmentService;
    private final UserRoleRepository userRoleRepository;
    private final RolePermissionRepository rolePermissionRepository;
    private final PermissionRepository permissionRepository;
    private final RoleRepository roleRepository;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public CurrentUserResponse current() {
        String userId = CurrentUserHolder.requireUserId();
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new IamException(ErrorCode.NOT_FOUND, "用户不存在"));

        List<String> roles = CurrentUserHolder.getRolesOrEmpty();
        // 真实聚合当前用户权限（覆盖原 Phase 2 占位的空列表）
        UserPermissionsResponse permissionsResponse = aggregatePermissions(userId, user.getTenantId());
        List<CurrentUserResponse.PermissionSummary> permissionSummaries = permissionsResponse.getPermissions().stream()
                .map(p -> CurrentUserResponse.PermissionSummary.builder()
                        .permissionId(p.getPermissionId())
                        .permissionCode(p.getPermissionCode())
                        .permissionName(p.getPermissionName())
                        .resourceType(p.getResourceType())
                        .build())
                .toList();

        List<CurrentUserResponse.DepartmentSummary> departments = userDepartmentService.listByUser(userId).stream()
                .map(ud -> CurrentUserResponse.DepartmentSummary.builder()
                        .departmentId(ud.getDepartmentId())
                        .departmentCode(ud.getDepartmentCode())
                        .departmentName(ud.getDepartmentName())
                        .isPrimary(ud.getIsPrimary())
                        .build())
                .toList();

        return CurrentUserResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .realName(user.getRealName())
                .tenantId(user.getTenantId())
                .roles(roles)
                .permissions(permissionSummaries)
                .departments(departments)
                .build();
    }

    /**
     * 当前用户权限聚合：user_role → role_permission → permission，并附带角色摘要。
     * 对齐 SPEC-TECH-IAM 3.5.8 GET /api/v1/iam/auth/me/permissions。
     */
    @Transactional(readOnly = true)
    public UserPermissionsResponse currentPermissions() {
        String userId = CurrentUserHolder.requireUserId();
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new IamException(ErrorCode.NOT_FOUND, "用户不存在"));
        return aggregatePermissions(userId, user.getTenantId());
    }

    private UserPermissionsResponse aggregatePermissions(String userId, String tenantId) {
        // 1. 查询用户角色绑定
        List<UserRoleEntity> userRoles = userRoleRepository.findByUserIdAndDeletedFalse(userId);
        if (userRoles.isEmpty()) {
            return UserPermissionsResponse.builder()
                    .userId(userId)
                    .tenantId(tenantId)
                    .permissionCodes(Collections.emptyList())
                    .permissions(Collections.emptyList())
                    .roles(Collections.emptyList())
                    .build();
        }

        List<String> roleIds = userRoles.stream().map(UserRoleEntity::getRoleId).distinct().toList();

        // 2. 查询角色详情（过滤软删除）
        List<RoleEntity> roleEntities = roleRepository.findAllById(roleIds).stream()
                .filter(r -> !Boolean.TRUE.equals(r.getDeleted()))
                .filter(r -> Boolean.TRUE.equals(r.getEnabled()))
                .toList();
        List<UserPermissionsResponse.RoleSummary> roleSummaries = roleEntities.stream()
                .map(r -> UserPermissionsResponse.RoleSummary.builder()
                        .roleId(r.getId())
                        .roleCode(r.getRoleCode())
                        .roleName(r.getRoleName())
                        .dataScope(r.getDataScope() == null ? null : r.getDataScope().name())
                        .build())
                .sorted(Comparator.comparing(UserPermissionsResponse.RoleSummary::getRoleCode,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();

        // 3. 聚合角色 → 权限 ID
        Set<String> permissionIds = new HashSet<>();
        for (String roleId : roleIds) {
            List<RolePermissionEntity> links = rolePermissionRepository.findByRoleIdAndDeletedFalse(roleId);
            links.stream().map(RolePermissionEntity::getPermissionId).forEach(permissionIds::add);
        }
        if (permissionIds.isEmpty()) {
            return UserPermissionsResponse.builder()
                    .userId(userId)
                    .tenantId(tenantId)
                    .permissionCodes(Collections.emptyList())
                    .permissions(Collections.emptyList())
                    .roles(roleSummaries)
                    .build();
        }

        // 4. 查询权限明细（过滤软删除），保留插入顺序便于稳定排序
        Map<String, PermissionEntity> permMap = new LinkedHashMap<>();
        permissionRepository.findAllById(permissionIds).stream()
                .filter(p -> !Boolean.TRUE.equals(p.getDeleted()))
                .forEach(p -> permMap.put(p.getId(), p));

        List<UserPermissionsResponse.PermissionDetail> details = new ArrayList<>(permMap.size());
        Set<String> codeSet = new HashSet<>();
        for (PermissionEntity p : permMap.values()) {
            List<String> actions = readActions(p.getActions());
            details.add(UserPermissionsResponse.PermissionDetail.builder()
                    .permissionId(p.getId())
                    .permissionCode(p.getPermissionCode())
                    .permissionName(p.getPermissionName())
                    .resourceType(p.getResourceType())
                    .actions(actions)
                    .effect(p.getEffect() == null ? null : p.getEffect().name())
                    .build());
            codeSet.add(p.getPermissionCode());
        }
        // 按 resourceType 升序、permissionCode 升序排序，便于前端按模块分组展示
        details.sort(Comparator
                .comparing(UserPermissionsResponse.PermissionDetail::getResourceType,
                        Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(UserPermissionsResponse.PermissionDetail::getPermissionCode,
                        Comparator.nullsLast(Comparator.naturalOrder())));

        return UserPermissionsResponse.builder()
                .userId(userId)
                .tenantId(tenantId)
                .permissionCodes(new ArrayList<>(codeSet))
                .permissions(details)
                .roles(roleSummaries)
                .build();
    }

    private List<String> readActions(String json) {
        if (json == null || json.isBlank()) {
            return Collections.emptyList();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {});
        } catch (JsonProcessingException e) {
            log.warn("权限 actions 反序列化失败: {}", json, e);
            return Collections.emptyList();
        }
    }
}
