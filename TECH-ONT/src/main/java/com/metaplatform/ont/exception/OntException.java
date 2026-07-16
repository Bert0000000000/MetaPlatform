package com.metaplatform.ont.exception;

import com.metaplatform.ont.common.ErrorCode;
import lombok.Getter;

@Getter
public class OntException extends RuntimeException {

    private final ErrorCode errorCode;

    public OntException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }

    public OntException(ErrorCode errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }
}
