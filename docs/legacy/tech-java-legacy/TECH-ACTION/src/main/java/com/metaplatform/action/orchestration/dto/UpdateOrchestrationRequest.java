package com.metaplatform.action.orchestration.dto;

import lombok.Data;

import java.util.Map;

@Data
public class UpdateOrchestrationRequest {

    private String name;
    private String description;
    private Map<String, Object> nodes;
    private Map<String, Object> edges;
}