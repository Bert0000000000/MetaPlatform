package com.metaplatform.mcp.common;

public class TenantContext {

    public static final String TENANT_ID_HEADER = "X-Tenant-Id";
    public static final String DEFAULT_TENANT_ID = "tenant-default";

    private static final ThreadLocal<String> TENANT_ID = new ThreadLocal<>();

    public static String getOrDefault() {
        String tenantId = TENANT_ID.get();
        return (tenantId == null || tenantId.isBlank()) ? DEFAULT_TENANT_ID : tenantId;
    }

    public static String get() {
        return TENANT_ID.get();
    }

    public static void set(String tenantId) {
        if (tenantId == null || tenantId.isBlank()) {
            tenantId = DEFAULT_TENANT_ID;
        }
        TENANT_ID.set(tenantId);
    }

    public static void clear() {
        TENANT_ID.remove();
    }
}
