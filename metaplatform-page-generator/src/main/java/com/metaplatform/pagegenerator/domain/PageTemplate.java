package com.metaplatform.pagegenerator.domain;

import com.metaplatform.pagegenerator.domain.enums.PageType;
import java.util.List;

/**
 * 页面模板 - 预定义的页面配置模板
 */
public class PageTemplate {

    private String code;
    private String name;
    private String description;
    private List<PageType> pageTypes;
    private String jsonConfig;

    public PageTemplate() {}

    public PageTemplate(String code, String name, String description,
                        List<PageType> pageTypes, String jsonConfig) {
        this.code = code;
        this.name = name;
        this.description = description;
        this.pageTypes = pageTypes;
        this.jsonConfig = jsonConfig;
    }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public List<PageType> getPageTypes() { return pageTypes; }
    public void setPageTypes(List<PageType> pageTypes) { this.pageTypes = pageTypes; }

    public String getJsonConfig() { return jsonConfig; }
    public void setJsonConfig(String jsonConfig) { this.jsonConfig = jsonConfig; }
}
