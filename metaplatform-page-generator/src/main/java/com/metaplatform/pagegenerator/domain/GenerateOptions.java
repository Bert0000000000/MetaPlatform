package com.metaplatform.pagegenerator.domain;

import java.util.Map;

/**
 * 生成选项 - 控制页面生成的额外参数
 */
public class GenerateOptions {

    private Integer columns = 2;
    private Boolean includeHidden = false;
    private Map<String, String> fieldOverrides;  // 字段名 → 自定义标签

    public GenerateOptions() {}

    public Integer getColumns() { return columns; }
    public void setColumns(Integer columns) { this.columns = columns; }

    public Boolean getIncludeHidden() { return includeHidden; }
    public void setIncludeHidden(Boolean includeHidden) { this.includeHidden = includeHidden; }

    public Map<String, String> getFieldOverrides() { return fieldOverrides; }
    public void setFieldOverrides(Map<String, String> fieldOverrides) { this.fieldOverrides = fieldOverrides; }
}
