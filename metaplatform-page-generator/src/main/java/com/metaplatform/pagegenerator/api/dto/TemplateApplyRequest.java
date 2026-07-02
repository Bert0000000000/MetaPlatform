package com.metaplatform.pagegenerator.api.dto;

import com.metaplatform.pagegenerator.domain.TemplateOverrides;
import jakarta.validation.constraints.NotBlank;

/**
 * 模板应用请求
 */
public class TemplateApplyRequest {

    @NotBlank
    private String objectCode;

    private TemplateOverrides overrides;

    public String getObjectCode() { return objectCode; }
    public void setObjectCode(String objectCode) { this.objectCode = objectCode; }

    public TemplateOverrides getOverrides() { return overrides; }
    public void setOverrides(TemplateOverrides overrides) { this.overrides = overrides; }
}
