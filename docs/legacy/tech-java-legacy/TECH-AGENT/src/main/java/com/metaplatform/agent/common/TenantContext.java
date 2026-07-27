package com.metaplatform.agent.common;

import java.util.UUID;

/**
 * 租户与链路上下文（ThreadLocal）。
 *
 * <p>由 {@link TraceFilter} 从请求头 {@code X-Tenant-Id} / {@code X-Trace-Id}
 * （以及 JWT claims）提取后注入，业务层通过静态方法读取，避免在方法签名上反复传递。</p>
 *
 * <p>注意：使用 Servlet 线程模型时务必在 finally 中 clear，避免线程复用导致上下文串号。
 * 虚拟线程场景同样适用（每次请求一个虚拟线程，ThreadLocal 仍可隔离）。</p>
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

    /**
     * 获取租户 ID，未设置时返回默认租户（用于内部任务等无 HTTP 上下文场景）。
     */
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

    /**
     * 获取 traceId，未设置时生成一个新的（用于异步任务等无 HTTP 上下文场景）。
     */
    public static String getTraceIdOrGenerate() {
        String tid = TRACE_ID.get();
        if (tid == null) {
            tid = UUID.randomUUID().toString().replace("-", "");
            TRACE_ID.set(tid);
        }
        return tid;
    }

    /**
     * 清理当前线程上下文。务必在请求结束时调用。
     */
    public static void clear() {
        TENANT_ID.remove();
        USER_ID.remove();
        TRACE_ID.remove();
    }
}
