package com.metaplatform.ea.ontmapping.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.Map;

@Data
public class OntologyChangeWebhookRequest {

    @NotBlank(message = "conceptId 不能为空")
    private String conceptId;

    private String conceptCode;

    private String conceptName;

    @NotBlank(message = "changeType 不能为空")
    private String changeType;

    private Map<String, Object> payload;
}
