package com.metaplatform.process.infrastructure.exception;

public class DslParseException extends RuntimeException {
    public DslParseException(String message) {
        super(message);
    }

    public DslParseException(String message, Throwable cause) {
        super(message, cause);
    }
}
