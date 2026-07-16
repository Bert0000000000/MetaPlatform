package com.metaplatform.ragmdm.common.exception;

public class ResourceNotFoundException extends RuntimeException {

    public ResourceNotFoundException(String resource, Long id) {
        super(String.format("%s not found with id: %d", resource, id));
    }

    public ResourceNotFoundException(String resource, String identifier) {
        super(String.format("%s not found: %s", resource, identifier));
    }
}
