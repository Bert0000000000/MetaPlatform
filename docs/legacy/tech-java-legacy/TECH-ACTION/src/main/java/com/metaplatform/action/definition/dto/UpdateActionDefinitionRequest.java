package com.metaplatform.action.definition.dto;

import lombok.Data;

import java.util.Map;

@Data
public class UpdateActionDefinitionRequest {

    private String name;
    private String description;
    private String method;
    private String url;
    private Map<String, Object> headers;
    private Map<String, Object> inputSchema;
    private Map<String, Object> outputSchema;
}