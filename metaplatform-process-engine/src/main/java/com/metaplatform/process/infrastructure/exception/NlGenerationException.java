package com.metaplatform.process.infrastructure.exception;

public class NlGenerationException extends RuntimeException {
    public NlGenerationException(String message) {
        super(message);
    }

    public NlGenerationException(String message, Throwable cause) {
        super(message, cause);
    }
}
