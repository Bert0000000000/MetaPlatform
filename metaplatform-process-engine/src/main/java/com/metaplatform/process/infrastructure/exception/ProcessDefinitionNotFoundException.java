package com.metaplatform.process.infrastructure.exception;

public class ProcessDefinitionNotFoundException extends ResourceNotFoundException {
    public ProcessDefinitionNotFoundException(String code) {
        super("ProcessDefinition", code);
    }
}
