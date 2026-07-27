package com.metaplatform.msg.common;

import lombok.Getter;

@Getter
public class MsgException extends RuntimeException {

    private final ErrorCode errorCode;

    public MsgException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }

    public MsgException(ErrorCode errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }
}
