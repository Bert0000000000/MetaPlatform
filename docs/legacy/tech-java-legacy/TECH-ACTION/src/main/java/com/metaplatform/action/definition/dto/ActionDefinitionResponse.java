package com.metaplatform.action.definition.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ActionDefinitionResponse {

    private String actionId;
    private String code;
    private String name;
    private String description;
    private String method;
    private String url;
    private Map<String, Object> headers;
    private Map<String, Object> inputSchema;
    private Map<String, Object> outputSchema;
    private String status;
    private Integer version;
    private String createdBy;
    private String updatedBy;
    private Instant createdAt;
    private Instant updatedAt;
}