package com.metaplatform.pagegenerator.infrastructure.exception;

/**
 * 自然语言生成异常
 */
public class NlGenerationException extends RuntimeException {

    public NlGenerationException(String message) {
        super(message);
    }

    public NlGenerationException(String message, Throwable cause) {
        super(message, cause);
    }
}
