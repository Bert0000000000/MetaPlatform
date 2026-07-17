package com.metaplatform.action.orchestration.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreateOrchestrationRequest {

    @NotBlank(message = "code 不能为空")
    private String code;

    @NotBlank(message = "name 不能为空")
    private String name;

    private String description;

    private String nodes = "[]";

    private String edges = "[]";
}
