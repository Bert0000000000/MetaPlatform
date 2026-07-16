package com.metaplatform.ai.interfaces.rest.dto;

public record ContextApiRequest(
    String role,
    String content
) {}
