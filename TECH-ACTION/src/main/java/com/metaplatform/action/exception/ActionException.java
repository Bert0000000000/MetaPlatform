package com.metaplatform.action.exception;

import com.metaplatform.action.common.ErrorCode;
import lombok.Getter;

@Getter
public class ActionException extends RuntimeException {

    private final ErrorCode errorCode;

    public ActionException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }

    public ActionException(ErrorCode errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }
}
