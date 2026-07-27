package com.metaplatform.ea.exception;

import com.metaplatform.ea.common.ErrorCode;
import lombok.Getter;

@Getter
public class EaException extends RuntimeException {

    private final ErrorCode errorCode;

    public EaException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }

    public EaException(ErrorCode errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }
}
