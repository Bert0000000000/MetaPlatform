package com.metaplatform.iam.common;

import org.slf4j.MDC;

import java.util.UUID;

public class TraceContext {

    public static final String TRACE_ID_HEADER = "X-Trace-Id";
    public static final String TRACE_ID_MDC_KEY = "traceId";

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

    public static void clear() {
        MDC.remove(TRACE_ID_MDC_KEY);
    }
}
