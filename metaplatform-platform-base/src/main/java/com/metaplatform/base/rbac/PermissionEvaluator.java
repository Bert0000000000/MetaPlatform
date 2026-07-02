package com.metaplatform.base.rbac;

import com.metaplatform.base.tenant.TenantContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class PermissionEvaluator {

    private final RoleRepository roleRepository;
    private final UserRoleRepository userRoleRepository;
    private final RbacCacheService cacheService;

    public PermissionEvaluator(RoleRepository roleRepository,
                               UserRoleRepository userRoleRepository,
                               RbacCacheService cacheService) {
        this.roleRepository = roleRepository;
        this.userRoleRepository = userRoleRepository;
        this.cacheService = cacheService;
    }

    /**
     * 检查用户是否拥有指定权限
     */
    public boolean hasPermission(UUID userId, String resource, String action) {
        Permission permission = Permission.of(resource, action);
        String tenantId = TenantContext.get().toString();

        // 1. 先查缓存
        Boolean cached = cacheService.hasPermission(tenantId, userId.toString(), permission);
        if (cached != null) {
            return cached;
        }

        // 2. 缓存未命中，查数据库
        List<Role> roles = roleRepository.findRolesByUser(
                TenantContext.get().value(), userId);

        Set<Permission> allPermissions = roles.stream()
                .flatMap(r -> r.getPermissions().stream())
                .collect(Collectors.toSet());

        // 3. 写入缓存
        cacheService.cachePermissions(tenantId, userId.toString(), allPermissions);

        return allPermissions.contains(permission);
    }

    /**
     * 获取用户所有权限
     */
    public Set<Permission> getUserPermissions(UUID userId) {
        String tenantId = TenantContext.get().toString();

        // 尝试从缓存获取
        Set<String> cached = cacheService.getCachedPermissionKeys(tenantId, userId.toString());
        if (!cached.isEmpty()) {
            return cached.stream()
                    .map(k -> {
                        String[] parts = k.split(":", 2);
                        return Permission.of(parts[0], parts[1]);
                    })
                    .collect(Collectors.toSet());
        }

        // 查数据库
        List<Role> roles = roleRepository.findRolesByUser(
                TenantContext.get().value(), userId);

        Set<Permission> allPermissions = roles.stream()
                .flatMap(r -> r.getPermissions().stream())
                .collect(Collectors.toSet());

        // 写入缓存
        cacheService.cachePermissions(tenantId, userId.toString(), allPermissions);

        return allPermissions;
    }
}
