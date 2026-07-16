package com.metaplatform.process.infrastructure.exception;

public class ProcessEngineException extends RuntimeException {
    public ProcessEngineException(String message) {
        super(message);
    }

    public ProcessEngineException(String message, Throwable cause) {
        super(message, cause);
    }
}
