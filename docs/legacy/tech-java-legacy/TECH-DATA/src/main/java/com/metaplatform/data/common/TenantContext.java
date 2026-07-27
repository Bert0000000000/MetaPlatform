package com.metaplatform.data.common;

import java.util.UUID;

/**
 * 租户与链路上下文（ThreadLocal）。
 *
 * <p>由 {@link TraceFilter} 从请求头 {@code X-Tenant-Id} / {@code X-Trace-Id}
 * 提取后注入，业务层通过静态方法读取。</p>
 */
public final class TenantContext {

    private static final ThreadLocal<String> TENANT_ID = new ThreadLocal<>();
    private static final ThreadLocal<String> USER_ID = new ThreadLocal<>();
    private static final ThreadLocal<String> TRACE_ID = new ThreadLocal<>();

    private TenantContext() {
    }

    public static void setTenantId(String tenantId) {
        TENANT_ID.set(tenantId);
    }

    public static String getTenantId() {
        return TENANT_ID.get();
    }

    public static String getTenantIdOrDefault() {
        String tid = TENANT_ID.get();
        return tid != null ? tid : "tenant-default";
    }

    public static void setUserId(String userId) {
        USER_ID.set(userId);
    }

    public static String getUserId() {
        return USER_ID.get();
    }

    public static void setTraceId(String traceId) {
        TRACE_ID.set(traceId);
    }

    public static String getTraceId() {
        return TRACE_ID.get();
    }

    public static String getTraceIdOrGenerate() {
        String tid = TRACE_ID.get();
        if (tid == null) {
            tid = UUID.randomUUID().toString().replace("-", "");
            TRACE_ID.set(tid);
        }
        return tid;
    }

    public static void clear() {
        TENANT_ID.remove();
        USER_ID.remove();
        TRACE_ID.remove();
    }
}
