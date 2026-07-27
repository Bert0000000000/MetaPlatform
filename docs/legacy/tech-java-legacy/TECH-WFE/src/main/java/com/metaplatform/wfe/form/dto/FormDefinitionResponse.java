package com.metaplatform.wfe.form.dto;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
public class FormDefinitionResponse {

    private String formId;

    private String appId;

    private Object globalSettings;

    private Object linkageRules;

    private Object scripts;

    private Instant createdAt;

    private Instant updatedAt;
}
