package com.metaplatform.process.api.dto;

import jakarta.validation.constraints.NotBlank;

public class NlProcessGenerateRequest {

    @NotBlank(message = "Description is required")
    private String description;

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}
