package com.metaplatform.iam.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.iam.common.ErrorCode;
import com.metaplatform.iam.dto.permission.PermissionCheckRequest;
import com.metaplatform.iam.dto.permission.PermissionCheckResponse;
import com.metaplatform.iam.entity.PermissionEntity;
import com.metaplatform.iam.entity.RolePermissionEntity;
import com.metaplatform.iam.exception.IamException;
import com.metaplatform.iam.repository.PermissionRepository;
import com.metaplatform.iam.repository.RolePermissionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class PermissionCheckService {

    private final RolePermissionRepository rolePermissionRepository;
    private final PermissionRepository permissionRepository;
    private final ObjectMapper objectMapper;

    /**
     * 权限检查：判断用户是否对指定资源拥有指定操作权限。
     *
     * <p>匹配规则：
     * <ol>
     *   <li>从 context 中获取用户角色 ID 列表</li>
     *   <li>查询角色关联的权限定义</li>
     *   <li>匹配 resource（支持通配符 * 和前缀匹配 type:*）</li>
     *   <li>匹配 action（权限 actions 数组中是否包含请求的 action）</li>
     *   <li>DENY 优先：即使有 ALLOW，只要存在匹配的 DENY 则拒绝</li>
     * </ol>
     *
     * @param request 权限检查请求
     * @return 权限检查结果
     */
    @Transactional(readOnly = true)
    public PermissionCheckResponse check(PermissionCheckRequest request) {
        String userId = request.getUserId();
        String resource = request.getResource();
        String action = request.getAction();
        validateAction(action);

        // 1. 从 context 中获取用户角色 ID 列表
        List<String> roleIds = extractRoleIds(request.getContext());
        if (roleIds.isEmpty()) {
            return PermissionCheckResponse.builder()
                    .allowed(false)
                    .reason("用户 " + userId + " 无关联角色，拒绝访问 " + resource + ":" + action)
                    .matchedPermissions(Collections.emptyList())
                    .build();
        }

        // 2. 查询角色关联的权限定义
        List<PermissionEntity> permissions = loadPermissionsForRoles(roleIds);
        if (permissions.isEmpty()) {
            return PermissionCheckResponse.builder()
                    .allowed(false)
                    .reason("用户 " + userId + " 的角色未关联任何权限定义")
                    .matchedPermissions(Collections.emptyList())
                    .build();
        }

        // 拆分请求 resource
        String[] parts = resource.split(":", 2);
        String reqResourceType = parts[0];
        String reqResourceId = parts.length > 1 ? parts[1] : null;

        // 3 & 4. 匹配 resource 和 action
        List<PermissionEntity> allowedMatches = new ArrayList<>();
        List<PermissionEntity> deniedMatches = new ArrayList<>();

        for (PermissionEntity perm : permissions) {
            if (!resourceMatches(perm, reqResourceType, reqResourceId)) {
                continue;
            }
            if (!actionMatches(perm, action)) {
                continue;
            }
            if (perm.getEffect() == PermissionEntity.Effect.DENY) {
                deniedMatches.add(perm);
            } else {
                allowedMatches.add(perm);
            }
        }

        // 5. DENY 优先
        if (!deniedMatches.isEmpty()) {
            List<String> deniedIds = deniedMatches.stream()
                    .map(PermissionEntity::getId).toList();
            String reason = String.format("DENY 策略生效，用户 %s 对 %s 的 %s 操作被拒绝（命中 %d 条 DENY 规则）",
                    userId, resource, action, deniedMatches.size());
            return PermissionCheckResponse.builder()
                    .allowed(false)
                    .reason(reason)
                    .matchedPermissions(deniedIds)
                    .build();
        }

        if (!allowedMatches.isEmpty()) {
            List<String> allowedIds = allowedMatches.stream()
                    .map(PermissionEntity::getId).toList();
            String permCodes = allowedMatches.stream()
                    .map(PermissionEntity::getPermissionCode)
                    .collect(Collectors.joining(", "));
            String reason = String.format("角色权限 %s 允许 %s 操作 on %s",
                    permCodes, action, resource);
            return PermissionCheckResponse.builder()
                    .allowed(true)
                    .reason(reason)
                    .matchedPermissions(allowedIds)
                    .build();
        }

        // 无匹配
        return PermissionCheckResponse.builder()
                .allowed(false)
                .reason(String.format("用户 %s 无 %s 权限 on %s", userId, action, resource))
                .matchedPermissions(Collections.emptyList())
                .build();
    }

    // ==================== 内部辅助 ====================

    @SuppressWarnings("unchecked")
    private List<String> extractRoleIds(Map<String, Object> context) {
        if (context == null) {
            return Collections.emptyList();
        }
        Object roleIds = context.get("roleIds");
        if (roleIds instanceof List<?> list) {
            return list.stream().map(Object::toString).toList();
        }
        return Collections.emptyList();
    }

    private List<PermissionEntity> loadPermissionsForRoles(List<String> roleIds) {
        Set<String> permissionIds = new HashSet<>();
        for (String roleId : roleIds) {
            List<RolePermissionEntity> links = rolePermissionRepository.findByRoleIdAndDeletedFalse(roleId);
            links.stream().map(RolePermissionEntity::getPermissionId).forEach(permissionIds::add);
        }
        if (permissionIds.isEmpty()) {
            return Collections.emptyList();
        }
        return permissionRepository.findAllById(permissionIds);
    }

    /**
     * 匹配 resource：权限定义的 resourceType/resourceId 与请求的 resourceType/resourceId 匹配。
     * 支持通配符 * 和前缀匹配。
     */
    private boolean resourceMatches(PermissionEntity perm, String reqResourceType, String reqResourceId) {
        // 匹配 resourceType
        if (!wildcardMatch(perm.getResourceType(), reqResourceType)) {
            return false;
        }
        // resourceId 为 null 表示通配该类型所有资源
        if (perm.getResourceId() == null || perm.getResourceId().isBlank()) {
            return true;
        }
        // 请求无 resourceId 但权限定义有 resourceId -> 不匹配
        if (reqResourceId == null) {
            return false;
        }
        return wildcardMatch(perm.getResourceId(), reqResourceId);
    }

    /**
     * 通配符匹配：支持 "*" 全匹配和 "prefix*" 前缀匹配。
     */
    private boolean wildcardMatch(String pattern, String value) {
        if (pattern == null || "*".equals(pattern)) {
            return true;
        }
        if (pattern.endsWith("*")) {
            String prefix = pattern.substring(0, pattern.length() - 1);
            return value != null && value.startsWith(prefix);
        }
        return pattern.equals(value);
    }

    /**
     * 匹配 action：权限定义的 actions JSON 数组中是否包含请求的 action。
     */
    private boolean actionMatches(PermissionEntity perm, String action) {
        List<String> actions = readJson(perm.getActions());
        return actions.contains(action) || actions.contains("*");
    }

    private void validateAction(String action) {
        List<String> validActions = List.of("READ", "CREATE", "UPDATE", "DELETE", "EXPORT", "IMPORT", "ADMIN");
        if (!validActions.contains(action)) {
            throw new IamException(ErrorCode.INVALID_FIELD_VALUE,
                    "不支持的操作类型: " + action + "，仅支持 " + validActions);
        }
    }

    private List<String> readJson(String json) {
        if (json == null || json.isBlank()) {
            return Collections.emptyList();
        }
        try {
            return objectMapper.readValue(json, objectMapper.getTypeFactory()
                    .constructCollectionType(List.class, String.class));
        } catch (JsonProcessingException e) {
            log.warn("actions 反序列化失败: {}", json, e);
            return Collections.emptyList();
        }
    }
}
