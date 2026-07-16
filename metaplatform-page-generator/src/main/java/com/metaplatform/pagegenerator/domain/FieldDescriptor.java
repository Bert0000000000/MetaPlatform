package com.metaplatform.pagegenerator.domain;

import com.metaplatform.pagegenerator.domain.enums.DataType;

/**
 * 字段描述符 - 用于描述 ObjectType 中的一个字段 (非 JPA 实体)
 * 由 ObjectTypeClient 从 ontology-engine 获取
 */
public class FieldDescriptor {

    private String code;
    private String label;
    private DataType dataType;
    private Integer maxLength;
    private boolean required;
    private boolean hidden;
    private String description;

    public FieldDescriptor() {}

    public FieldDescriptor(String code, String label, DataType dataType) {
        this.code = code;
        this.label = label;
        this.dataType = dataType;
    }

    public FieldDescriptor(String code, String label, DataType dataType, Integer maxLength) {
        this.code = code;
        this.label = label;
        this.dataType = dataType;
        this.maxLength = maxLength;
    }

    public FieldDescriptor(String code, String label, DataType dataType,
                           Integer maxLength, boolean required, boolean hidden) {
        this.code = code;
        this.label = label;
        this.dataType = dataType;
        this.maxLength = maxLength;
        this.required = required;
        this.hidden = hidden;
    }

    // Getters and Setters
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }

    public DataType getDataType() { return dataType; }
    public void setDataType(DataType dataType) { this.dataType = dataType; }

    public Integer getMaxLength() { return maxLength; }
    public void setMaxLength(Integer maxLength) { this.maxLength = maxLength; }

    public boolean isRequired() { return required; }
    public void setRequired(boolean required) { this.required = required; }

    public boolean isHidden() { return hidden; }
    public void setHidden(boolean hidden) { this.hidden = hidden; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}
