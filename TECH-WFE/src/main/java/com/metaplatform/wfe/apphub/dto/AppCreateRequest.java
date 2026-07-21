package com.metaplatform.wfe.apphub.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class AppCreateRequest {

    @NotBlank(message = "应用名称不能为空")
    private String name;

    @NotBlank(message = "应用编码不能为空")
    private String code;

    private String description;

    private String icon;

    private String group;

    private String status = "DESIGNING";
}
