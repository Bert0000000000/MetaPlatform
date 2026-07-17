package com.metaplatform.mcp.exception;

import com.metaplatform.mcp.common.ErrorCode;
import lombok.Getter;

@Getter
public class McpException extends RuntimeException {

    private final ErrorCode errorCode;

    public McpException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }

    public McpException(ErrorCode errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }
}
