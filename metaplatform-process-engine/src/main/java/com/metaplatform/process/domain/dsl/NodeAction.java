package com.metaplatform.process.domain.dsl;

public class NodeAction {
    private String type;
    private String variable;
    private String value;

    public NodeAction() {}

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getVariable() { return variable; }
    public void setVariable(String variable) { this.variable = variable; }
    public String getValue() { return value; }
    public void setValue(String value) { this.value = value; }
}
