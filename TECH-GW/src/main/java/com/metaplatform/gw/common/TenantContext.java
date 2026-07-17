package com.metaplatform.gw.common;

import org.springframework.http.server.reactive.ServerHttpRequest;

import java.util.UUID;

/**
 * Helper for resolving the tenant id from incoming requests.
 */
public class TenantContext {

    public static final String DEFAULT_TENANT = "tenant-default";
    public static final String TENANT_HEADER = "X-Tenant-Id";

    /**
     * Resolve tenant id from a request, falling back to the default tenant when missing.
     */
    public static String resolveOrDefault(ServerHttpRequest request) {
        String tenant = request.getHeaders().getFirst(TENANT_HEADER);
        if (tenant == null || tenant.isBlank()) {
            tenant = request.getHeaders().getFirst(TraceContext.TRACE_ID_HEADER + "-Tenant");
        }
        if (tenant == null || tenant.isBlank()) {
            tenant = DEFAULT_TENANT;
        }
        return tenant;
    }

    public static String resolveOrDefault(String tenantId) {
        return (tenantId == null || tenantId.isBlank()) ? DEFAULT_TENANT : tenantId;
    }

    public static String newId() {
        return UUID.randomUUID().toString();
    }
}
