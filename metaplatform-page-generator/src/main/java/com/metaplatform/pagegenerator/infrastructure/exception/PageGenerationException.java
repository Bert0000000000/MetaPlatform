package com.metaplatform.pagegenerator.infrastructure.exception;

/**
 * 页面生成异常
 */
public class PageGenerationException extends RuntimeException {

    public PageGenerationException(String message) {
        super(message);
    }

    public PageGenerationException(String message, Throwable cause) {
        super(message, cause);
    }
}
