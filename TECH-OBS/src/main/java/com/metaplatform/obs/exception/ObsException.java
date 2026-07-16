package com.metaplatform.obs.exception;

import com.metaplatform.obs.common.ErrorCode;
import lombok.Getter;

@Getter
public class ObsException extends RuntimeException {

    private final ErrorCode errorCode;

    public ObsException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }

    public ObsException(ErrorCode errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }
}
