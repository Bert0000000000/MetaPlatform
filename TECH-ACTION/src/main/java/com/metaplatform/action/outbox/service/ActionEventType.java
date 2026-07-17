package com.metaplatform.action.outbox.service;

public final class ActionEventType {

    public static final String ACTION_EXECUTED = "ACTION_EXECUTED";
    public static final String ORCHESTRATION_STARTED = "ORCHESTRATION_STARTED";
    public static final String ORCHESTRATION_COMPLETED = "ORCHESTRATION_COMPLETED";
    public static final String ORCHESTRATION_FAILED = "ORCHESTRATION_FAILED";

    public static final String TRACE_ID_HEADER = "X-Trace-Id";
    public static final String TENANT_ID_HEADER = "X-Tenant-Id";
    public static final String EVENT_TYPE_HEADER = "X-Event-Type";

    private ActionEventType() {
    }
}
