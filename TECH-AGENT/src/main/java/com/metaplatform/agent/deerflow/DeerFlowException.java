package com.metaplatform.agent.deerflow;

import lombok.Getter;

@Getter
public class DeerFlowException extends RuntimeException {
    private final String code;
    private final Integer status;
    public DeerFlowException(String code, String message, Integer status, Throwable cause) {
        super(message, cause); this.code = code; this.status = status;
    }
    public static DeerFlowException disabled() {
        return new DeerFlowException("DEERFLOW_DISABLED", "DeerFlow runtime is disabled", null, null);
    }
}
