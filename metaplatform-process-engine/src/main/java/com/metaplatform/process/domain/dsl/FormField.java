package com.metaplatform.process.domain.dsl;

import java.util.List;

public class FormField {
    private String code;
    private String label;
    private String type;
    private boolean required;
    private List<String> options;

    public FormField() {}

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public boolean isRequired() { return required; }
    public void setRequired(boolean required) { this.required = required; }
    public List<String> getOptions() { return options; }
    public void setOptions(List<String> options) { this.options = options; }
}
