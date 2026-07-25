package com.metaplatform.mcp.common;

import org.slf4j.MDC;

import java.util.UUID;

public class TraceContext {

    public static final String TRACE_ID_HEADER = "X-Trace-Id";
    public static final String TRACE_ID_MDC_KEY = "traceId";
    public static final String USER_ID_MDC_KEY = "userId";

    public static String getOrCreate() {
        String traceId = MDC.get(TRACE_ID_MDC_KEY);
        if (traceId == null || traceId.isBlank()) {
            traceId = UUID.randomUUID().toString();
            MDC.put(TRACE_ID_MDC_KEY, traceId);
        }
        return traceId;
    }

    public static void set(String traceId) {
        if (traceId == null || traceId.isBlank()) {
            traceId = UUID.randomUUID().toString();
        }
        MDC.put(TRACE_ID_MDC_KEY, traceId);
    }

    public static String get() {
        return MDC.get(TRACE_ID_MDC_KEY);
    }

    public static String getUserId() {
        return MDC.get(USER_ID_MDC_KEY);
    }

    public static void setUserId(String userId) {
        if (userId != null && !userId.isBlank()) {
            MDC.put(USER_ID_MDC_KEY, userId);
        }
    }

    public static void clear() {
        MDC.remove(TRACE_ID_MDC_KEY);
        MDC.remove(USER_ID_MDC_KEY);
    }
}
