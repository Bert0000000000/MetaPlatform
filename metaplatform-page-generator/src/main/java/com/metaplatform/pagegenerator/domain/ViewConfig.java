package com.metaplatform.pagegenerator.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

/**
 * 视图配置 - 嵌入在 PageConfig 中
 */
@Embeddable
public class ViewConfig {

    @Column(columnDefinition = "TEXT")
    private String filters;           // 预设筛选条件 JSON

    @Column(columnDefinition = "TEXT")
    private String sortRules;         // 排序规则 JSON

    private Integer defaultPageSize = 20;
    private Boolean showHeader = true;
    private Boolean showBreadcrumb = true;

    @Column(columnDefinition = "TEXT")
    private String actionButtons;     // 操作按钮配置 JSON

    public ViewConfig() {}

    public String getFilters() { return filters; }
    public void setFilters(String filters) { this.filters = filters; }

    public String getSortRules() { return sortRules; }
    public void setSortRules(String sortRules) { this.sortRules = sortRules; }

    public Integer getDefaultPageSize() { return defaultPageSize; }
    public void setDefaultPageSize(Integer defaultPageSize) { this.defaultPageSize = defaultPageSize; }

    public Boolean getShowHeader() { return showHeader; }
    public void setShowHeader(Boolean showHeader) { this.showHeader = showHeader; }

    public Boolean getShowBreadcrumb() { return showBreadcrumb; }
    public void setShowBreadcrumb(Boolean showBreadcrumb) { this.showBreadcrumb = showBreadcrumb; }

    public String getActionButtons() { return actionButtons; }
    public void setActionButtons(String actionButtons) { this.actionButtons = actionButtons; }
}
