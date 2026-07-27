package com.metaplatform.action.orchestration.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.Map;

@Data
public class CreateOrchestrationRequest {

    @NotBlank(message = "code 不能为空")
    private String code;

    @NotBlank(message = "name 不能为空")
    private String name;

    private String description;

    private Map<String, Object> nodes;

    private Map<String, Object> edges;
}