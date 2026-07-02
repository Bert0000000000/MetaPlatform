package com.metaplatform.pagegenerator.api.dto;

import com.metaplatform.pagegenerator.domain.PageSection;
import com.metaplatform.pagegenerator.domain.ViewConfig;
import com.metaplatform.pagegenerator.domain.enums.PageType;
import java.util.List;

/**
 * 更新 PageConfig 请求
 */
public class PageConfigUpdateRequest {

    private String name;
    private PageType pageType;
    private List<PageSection> sections;
    private ViewConfig viewConfig;

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public PageType getPageType() { return pageType; }
    public void setPageType(PageType pageType) { this.pageType = pageType; }

    public List<PageSection> getSections() { return sections; }
    public void setSections(List<PageSection> sections) { this.sections = sections; }

    public ViewConfig getViewConfig() { return viewConfig; }
    public void setViewConfig(ViewConfig viewConfig) { this.viewConfig = viewConfig; }
}
