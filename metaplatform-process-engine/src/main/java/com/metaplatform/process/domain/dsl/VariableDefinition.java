package com.metaplatform.process.domain.dsl;

import com.metaplatform.process.domain.enums.VariableType;

public class VariableDefinition {
    private String name;
    private VariableType type;
    private boolean required;
    private String defaultValue;

    public VariableDefinition() {}

    public VariableDefinition(String name, VariableType type, boolean required) {
        this.name = name;
        this.type = type;
        this.required = required;
    }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public VariableType getType() { return type; }
    public void setType(VariableType type) { this.type = type; }
    public boolean isRequired() { return required; }
    public void setRequired(boolean required) { this.required = required; }
    public String getDefaultValue() { return defaultValue; }
    public void setDefaultValue(String defaultValue) { this.defaultValue = defaultValue; }
}
