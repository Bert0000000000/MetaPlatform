package com.metaplatform.base.rbac;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Service
public class RbacCacheService {

    private static final String KEY_PREFIX = "rbac:permissions:";

    private final StringRedisTemplate redisTemplate;
    private final long cacheTtlSeconds;

    public RbacCacheService(StringRedisTemplate redisTemplate,
                            @Value("${platform.rbac.cache-ttl-seconds:300}") long cacheTtlSeconds) {
        this.redisTemplate = redisTemplate;
        this.cacheTtlSeconds = cacheTtlSeconds;
    }

    /**
     * 缓存用户的权限集合。key: rbac:permissions:{tenantId}:{userId}
     * value: resource:action 的 Set
     */
    public void cachePermissions(String tenantId, String userId, Set<Permission> permissions) {
        String key = buildKey(tenantId, userId);
        Set<String> permissionKeys = permissions.stream()
                .map(Permission::toKey)
                .collect(Collectors.toSet());
        redisTemplate.delete(key);
        if (!permissionKeys.isEmpty()) {
            redisTemplate.opsForSet().add(key, permissionKeys.toArray(new String[0]));
        }
        redisTemplate.expire(key, cacheTtlSeconds, TimeUnit.SECONDS);
    }

    /**
     * 查询缓存中用户是否拥有指定权限
     */
    public Boolean hasPermission(String tenantId, String userId, Permission permission) {
        String key = buildKey(tenantId, userId);
        return redisTemplate.opsForSet().isMember(key, permission.toKey());
    }

    /**
     * 获取缓存中用户的所有权限 key
     */
    public Set<String> getCachedPermissionKeys(String tenantId, String userId) {
        String key = buildKey(tenantId, userId);
        Set<String> members = redisTemplate.opsForSet().members(key);
        return members != null ? members : Set.of();
    }

    /**
     * 使缓存失效
     */
    public void evict(String tenantId, String userId) {
        String key = buildKey(tenantId, userId);
        redisTemplate.delete(key);
    }

    private String buildKey(String tenantId, String userId) {
        return KEY_PREFIX + tenantId + ":" + userId;
    }
}
