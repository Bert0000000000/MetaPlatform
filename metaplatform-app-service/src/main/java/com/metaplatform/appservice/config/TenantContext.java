package com.metaplatform.appservice.security;

/**
 * 当前线程的租户上下文。
 *
 * <p>所有 Repository / Service 都通过 {@code TenantContext.currentTenant()} 获取当前租户，
 * 强制每条查询都带 tenant_id 过滤（详见 ontology-engine 的 {@code TenantFilter} 同样思路）。
 */
public final class TenantContext {
    private static final ThreadLocal<String> CURRENT = new ThreadLocal<>();

    private TenantContext() {}

    public static void set(String tenantId) {
        CURRENT.set(tenantId);
    }

    public static String get() {
        return CURRENT.get();
    }

    /** 取当前租户或抛 {@link TenantMissingException}（在拦截器层强制）。 */
    public static String required() {
        String t = CURRENT.get();
        if (t == null || t.isBlank()) {
            throw new TenantMissingException();
        }
        return t;
    }

    public static void clear() {
        CURRENT.remove();
    }

    public static class TenantMissingException extends RuntimeException {
        public TenantMissingException() {
            super("当前线程没有设置 TenantContext（通常由 TenantFilter 拦截）");
        }
    }
}
