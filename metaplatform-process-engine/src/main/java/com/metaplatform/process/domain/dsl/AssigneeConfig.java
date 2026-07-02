package com.metaplatform.process.domain.dsl;

import com.metaplatform.process.domain.enums.AssigneeType;

public class AssigneeConfig {
    private AssigneeType type;
    private String value;

    public AssigneeConfig() {}

    public AssigneeConfig(AssigneeType type, String value) {
        this.type = type;
        this.value = value;
    }

    public AssigneeType getType() { return type; }
    public void setType(AssigneeType type) { this.type = type; }
    public String getValue() { return value; }
    public void setValue(String value) { this.value = value; }
}
