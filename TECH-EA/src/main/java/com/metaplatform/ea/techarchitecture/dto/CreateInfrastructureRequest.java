package com.metaplatform.ea.techarchitecture.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreateInfrastructureRequest {

    @NotBlank(message = "基础设施名称不能为空")
    private String name;

    @NotBlank(message = "基础设施编码不能为空")
    private String code;

    private String environment;
    private String region;
    private String description;
    private String metadata;
}