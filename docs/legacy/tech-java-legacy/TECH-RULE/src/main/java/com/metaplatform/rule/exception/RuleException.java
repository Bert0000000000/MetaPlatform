package com.metaplatform.rule.exception;

import com.metaplatform.rule.common.ErrorCode;
import lombok.Getter;

@Getter
public class RuleException extends RuntimeException {

    private final ErrorCode errorCode;

    public RuleException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }

    public RuleException(ErrorCode errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }
}
