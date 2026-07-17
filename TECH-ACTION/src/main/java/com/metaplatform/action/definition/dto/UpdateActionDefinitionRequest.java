package com.metaplatform.action.definition.dto;

import lombok.Data;

@Data
public class UpdateActionDefinitionRequest {

    private String name;
    private String description;
    private String method;
    private String url;
    private String headers;
    private String inputSchema;
    private String outputSchema;
}
