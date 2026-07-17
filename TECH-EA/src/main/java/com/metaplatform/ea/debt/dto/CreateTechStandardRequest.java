package com.metaplatform.ea.debt.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreateTechStandardRequest {

    @NotBlank(message = "技术标准名称不能为空")
    private String name;

    @NotBlank(message = "技术标准编码不能为空")
    private String code;

    private String category;
    private String version;
    private String description;
    private Boolean mandatory;
    private String metadata;
}