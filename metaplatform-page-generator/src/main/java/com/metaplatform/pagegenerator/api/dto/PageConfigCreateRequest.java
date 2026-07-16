package com.metaplatform.pagegenerator.api.dto;

import com.metaplatform.pagegenerator.domain.enums.PageType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * 创建 PageConfig 请求
 */
public class PageConfigCreateRequest {

    @NotBlank
    private String name;

    @NotBlank
    private String code;

    @NotNull
    private PageType pageType;

    private String objectCode;

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public PageType getPageType() { return pageType; }
    public void setPageType(PageType pageType) { this.pageType = pageType; }

    public String getObjectCode() { return objectCode; }
    public void setObjectCode(String objectCode) { this.objectCode = objectCode; }
}
