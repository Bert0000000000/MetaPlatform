package com.metaplatform.process.api.dto;

import jakarta.validation.constraints.NotBlank;

public class ProcessDefinitionUpdateRequest {

    private String name;

    @NotBlank(message = "DSL JSON is required")
    private String dslJson;

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDslJson() { return dslJson; }
    public void setDslJson(String dslJson) { this.dslJson = dslJson; }
}
