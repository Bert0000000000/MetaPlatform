package com.metaplatform.ea.application.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class CreateApplicationRequest {

    @NotBlank(message = "应用名称不能为空")
    private String name;

    @NotBlank(message = "应用编码不能为空")
    private String code;

    private String description;
    private String appType;
    private List<String> techStack;
    private List<String> dependencies;
}
