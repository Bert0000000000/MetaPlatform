package com.metaplatform.process.api.dto;

import jakarta.validation.constraints.NotBlank;

public class ProcessDefinitionCreateRequest {

    @NotBlank(message = "DSL JSON is required")
    private String dslJson;

    private String triggerType;
    private String triggerConfig;

    public String getDslJson() { return dslJson; }
    public void setDslJson(String dslJson) { this.dslJson = dslJson; }
    public String getTriggerType() { return triggerType; }
    public void setTriggerType(String triggerType) { this.triggerType = triggerType; }
    public String getTriggerConfig() { return triggerConfig; }
    public void setTriggerConfig(String triggerConfig) { this.triggerConfig = triggerConfig; }
}
