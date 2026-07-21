package com.metaplatform.wfe.form.dto;

import jakarta.validation.Valid;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class FormValidateRequest {

    @Valid
    private List<FormFieldMeta> fields;

    private Map<String, Object> globalSettings;

    @Valid
    private List<FormLinkageRule> linkageRules;

    private Map<String, String> scripts;

    private Map<String, Object> values;
}
