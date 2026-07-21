package com.metaplatform.wfe.form.dto;

import jakarta.validation.Valid;
import lombok.Data;

import java.util.List;

@Data
public class FormLinkageRulesRequest {

    @Valid
    private List<FormLinkageRule> rules;
}
