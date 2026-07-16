package com.metaplatform.obs.common;

public class TenantContext {

    public static final String DEFAULT_TENANT_ID = "tenant-default";

    private static final ThreadLocal<String> CURRENT_TENANT = new ThreadLocal<>();

    public static void set(String tenantId) {
        CURRENT_TENANT.set(tenantId);
    }

    public static void clear() {
        CURRENT_TENANT.remove();
    }

    public static String get() {
        String tenantId = CURRENT_TENANT.get();
        return tenantId != null && !tenantId.isBlank() ? tenantId : DEFAULT_TENANT_ID;
    }
}
