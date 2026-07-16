package com.metaplatform.base.tenant;

public final class TenantContext {

    private static final ThreadLocal<TenantId> CONTEXT = new ThreadLocal<>();

    private TenantContext() {}

    public static void set(TenantId tenantId) {
        CONTEXT.set(tenantId);
    }

    public static TenantId get() {
        TenantId id = CONTEXT.get();
        if (id == null) {
            throw new IllegalStateException("TenantContext not set. Ensure TenantInterceptor is active.");
        }
        return id;
    }

    public static TenantId getOrNull() {
        return CONTEXT.get();
    }

    public static void clear() {
        CONTEXT.remove();
    }
}
