package com.metaplatform.pagegenerator.api.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 自然语言页面生成请求
 */
public class NlPageGenerateRequest {

    @NotBlank
    private String description;

    private String objectCode;

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getObjectCode() { return objectCode; }
    public void setObjectCode(String objectCode) { this.objectCode = objectCode; }
}
