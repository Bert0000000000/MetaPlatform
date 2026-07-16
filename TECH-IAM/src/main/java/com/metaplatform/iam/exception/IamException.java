package com.metaplatform.iam.exception;

import com.metaplatform.iam.common.ErrorCode;
import lombok.Getter;

@Getter
public class IamException extends RuntimeException {

    private final ErrorCode errorCode;

    public IamException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }

    public IamException(ErrorCode errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }
}
