package com.metaplatform.action.orchestration.dto;

import lombok.Data;

@Data
public class UpdateOrchestrationRequest {

    private String name;
    private String description;
    private String nodes;
    private String edges;
}
