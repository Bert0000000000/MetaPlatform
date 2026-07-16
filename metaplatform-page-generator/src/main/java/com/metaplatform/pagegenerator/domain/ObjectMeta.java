package com.metaplatform.pagegenerator.domain;

import java.util.List;

/**
 * 对象元数据 - 从 ontology-engine 获取的 ObjectType 摘要
 * 用于 PageGeneratorService 生成页面配置
 */
public class ObjectMeta {

    private String code;
    private String label;
    private String description;
    private List<FieldDescriptor> fields;

    public ObjectMeta() {}

    public ObjectMeta(String code, String label, List<FieldDescriptor> fields) {
        this.code = code;
        this.label = label;
        this.fields = fields;
    }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public List<FieldDescriptor> getFields() { return fields; }
    public void setFields(List<FieldDescriptor> fields) { this.fields = fields; }
}
