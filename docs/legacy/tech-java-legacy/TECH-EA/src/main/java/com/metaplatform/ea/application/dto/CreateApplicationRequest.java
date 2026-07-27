package com.metaplatform.ea.application.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.Map;

@Data
public class CreateApplicationRequest {

    @NotBlank(message = "应用名称不能为空")
    private String name;

    @NotBlank(message = "应用编码不能为空")
    private String code;

    private String description;
    private String appType;
    private Map<String, Object> techStack;
    private Map<String, Object> dependencies;
    private Map<String, Object> capabilityIds;
}