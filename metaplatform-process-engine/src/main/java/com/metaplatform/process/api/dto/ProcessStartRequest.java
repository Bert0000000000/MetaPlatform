package com.metaplatform.process.api.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.Map;

public class ProcessStartRequest {

    @NotBlank(message = "Definition code is required")
    private String definitionCode;

    private String businessKey;

    private Map<String, Object> variables;

    public String getDefinitionCode() { return definitionCode; }
    public void setDefinitionCode(String definitionCode) { this.definitionCode = definitionCode; }
    public String getBusinessKey() { return businessKey; }
    public void setBusinessKey(String businessKey) { this.businessKey = businessKey; }
    public Map<String, Object> getVariables() { return variables; }
    public void setVariables(Map<String, Object> variables) { this.variables = variables; }
}
