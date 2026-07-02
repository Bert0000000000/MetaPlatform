package com.metaplatform.ragmdm.common.exception;

public class UnsupportedFileTypeException extends RuntimeException {

    public UnsupportedFileTypeException(String fileType) {
        super("Unsupported file type: " + fileType);
    }
}
