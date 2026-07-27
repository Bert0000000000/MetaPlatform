package com.metaplatform.wfe.form.dto;

import lombok.Data;

@Data
public class FormScriptsRequest {

    private String beforeSubmit;

    private String afterSubmit;

    private String onChange;
}
