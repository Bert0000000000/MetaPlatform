package com.metaplatform.ea.techarchitecture.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreateTechStackRequest {

    @NotBlank(message = "技术栈名称不能为空")
    private String name;

    @NotBlank(message = "技术栈编码不能为空")
    private String code;

    private String category;
    private String vendor;
    private String description;
    private String version;
    private String lifecycleStatus;
    private String metadata;
}