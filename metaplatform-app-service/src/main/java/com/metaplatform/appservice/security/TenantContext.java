package com.metaplatform.appservice.security;

import java.util.Collections;
import java.util.List;

/**
 * 当前线程的租户/用户/角色上下文。
 *
 * <p>所有 Repository / Service 都通过 {@code TenantContext.currentTenant()} 获取当前租户，
 * 强制每条查询都带 tenant_id 过滤（详见 ontology-engine 的 {@code TenantFilter} 同样思路）。
 */
public final class TenantContext {
    private static final ThreadLocal<Context> CURRENT = new ThreadLocal<>();

    private TenantContext() {}

    public static void set(String tenantId) {
        Context ctx = CURRENT.get();
        if (ctx == null) ctx = new Context();
        ctx.tenantId = tenantId;
        CURRENT.set(ctx);
    }

    public static void setUser(String userId, List<String> roles) {
        Context ctx = CURRENT.get();
        if (ctx == null) ctx = new Context();
        ctx.userId = userId;
        ctx.roles = roles != null ? roles : Collections.emptyList();
        CURRENT.set(ctx);
    }

    public static String get() {
        Context ctx = CURRENT.get();
        return ctx == null ? null : ctx.tenantId;
    }

    public static String currentUserId() {
        Context ctx = CURRENT.get();
        return ctx == null ? null : ctx.userId;
    }

    public static List<String> currentRoles() {
        Context ctx = CURRENT.get();
        return ctx == null || ctx.roles == null ? Collections.emptyList() : ctx.roles;
    }

    public static boolean hasRole(String role) {
        return currentRoles().contains(role);
    }

    /** 取当前租户或抛 {@link TenantMissingException}（在拦截器层强制）。 */
    public static String required() {
        String t = get();
        if (t == null || t.isBlank()) {
            throw new TenantMissingException();
        }
        return t;
    }

    public static void clear() {
        CURRENT.remove();
    }

    private static class Context {
        String tenantId;
        String userId;
        List<String> roles;
    }

    public static class TenantMissingException extends RuntimeException {
        public TenantMissingException() {
            super("当前线程没有设置 TenantContext（通常由 TenantFilter 拦截）");
        }
    }
}
