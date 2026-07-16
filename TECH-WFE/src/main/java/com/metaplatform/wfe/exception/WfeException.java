package com.metaplatform.wfe.exception;

import com.metaplatform.wfe.common.ErrorCode;
import lombok.Getter;

@Getter
public class WfeException extends RuntimeException {

    private final ErrorCode errorCode;

    public WfeException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }

    public WfeException(ErrorCode errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }
}
