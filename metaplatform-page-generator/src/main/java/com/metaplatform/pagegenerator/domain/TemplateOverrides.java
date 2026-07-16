package com.metaplatform.pagegenerator.domain;

import java.util.Map;

/**
 * 模板覆盖参数 - 应用模板时的自定义覆盖
 */
public class TemplateOverrides {

    private String namePrefix;
    private Integer columns;
    private Map<String, String> fieldLabelOverrides;
    private Boolean includeHidden;

    public TemplateOverrides() {}

    public String getNamePrefix() { return namePrefix; }
    public void setNamePrefix(String namePrefix) { this.namePrefix = namePrefix; }

    public Integer getColumns() { return columns; }
    public void setColumns(Integer columns) { this.columns = columns; }

    public Map<String, String> getFieldLabelOverrides() { return fieldLabelOverrides; }
    public void setFieldLabelOverrides(Map<String, String> fieldLabelOverrides) { this.fieldLabelOverrides = fieldLabelOverrides; }

    public Boolean getIncludeHidden() { return includeHidden; }
    public void setIncludeHidden(Boolean includeHidden) { this.includeHidden = includeHidden; }
}
