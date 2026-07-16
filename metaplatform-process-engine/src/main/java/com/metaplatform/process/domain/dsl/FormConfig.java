package com.metaplatform.process.domain.dsl;

import java.util.ArrayList;
import java.util.List;

public class FormConfig {
    private List<FormField> fields = new ArrayList<>();

    public FormConfig() {}

    public List<FormField> getFields() { return fields; }
    public void setFields(List<FormField> fields) { this.fields = fields; }
}
