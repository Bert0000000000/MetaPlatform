package com.metaplatform.process.api.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.Map;

public class TaskCompleteRequest {

    @NotBlank(message = "Result is required")
    private String result;

    private String comment;

    private Map<String, Object> formData;

    public String getResult() { return result; }
    public void setResult(String result) { this.result = result; }
    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }
    public Map<String, Object> getFormData() { return formData; }
    public void setFormData(Map<String, Object> formData) { this.formData = formData; }
}
