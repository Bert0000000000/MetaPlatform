package com.metaplatform.pagegenerator.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

/**
 * 表格配置 - 嵌入在 PageSection 中
 */
@Embeddable
public class TableConfig {

    private Boolean pagination = true;
    private Integer pageSize = 20;
    private Boolean sortable = true;
    private Boolean filterable = true;
    private Boolean selectable = true;
    private Boolean exportable = true;

    @Column(columnDefinition = "TEXT")
    private String columnConfig;   // 列配置 JSON

    @Column(columnDefinition = "TEXT")
    private String defaultSort;    // 默认排序 JSON

    public TableConfig() {}

    public TableConfig(Boolean pagination, Integer pageSize, Boolean sortable,
                       Boolean filterable, Boolean selectable, Boolean exportable) {
        this.pagination = pagination;
        this.pageSize = pageSize;
        this.sortable = sortable;
        this.filterable = filterable;
        this.selectable = selectable;
        this.exportable = exportable;
    }

    public Boolean getPagination() { return pagination; }
    public void setPagination(Boolean pagination) { this.pagination = pagination; }

    public Integer getPageSize() { return pageSize; }
    public void setPageSize(Integer pageSize) { this.pageSize = pageSize; }

    public Boolean getSortable() { return sortable; }
    public void setSortable(Boolean sortable) { this.sortable = sortable; }

    public Boolean getFilterable() { return filterable; }
    public void setFilterable(Boolean filterable) { this.filterable = filterable; }

    public Boolean getSelectable() { return selectable; }
    public void setSelectable(Boolean selectable) { this.selectable = selectable; }

    public Boolean getExportable() { return exportable; }
    public void setExportable(Boolean exportable) { this.exportable = exportable; }

    public String getColumnConfig() { return columnConfig; }
    public void setColumnConfig(String columnConfig) { this.columnConfig = columnConfig; }

    public String getDefaultSort() { return defaultSort; }
    public void setDefaultSort(String defaultSort) { this.defaultSort = defaultSort; }
}
