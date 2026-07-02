package com.metaplatform.pagegenerator.api.dto;

import com.metaplatform.pagegenerator.domain.GenerateOptions;
import com.metaplatform.pagegenerator.domain.enums.PageType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * 页面生成请求
 */
public class PageGenerateRequest {

    @NotBlank
    private String objectCode;

    @NotNull
    private PageType pageType;

    private GenerateOptions options;

    public String getObjectCode() { return objectCode; }
    public void setObjectCode(String objectCode) { this.objectCode = objectCode; }

    public PageType getPageType() { return pageType; }
    public void setPageType(PageType pageType) { this.pageType = pageType; }

    public GenerateOptions getOptions() { return options; }
    public void setOptions(GenerateOptions options) { this.options = options; }
}
