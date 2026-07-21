package com.metaplatform.ea.techcomponent.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreateTechnologyComponentRequest {

    @NotBlank(message = "组件名称不能为空")
    private String name;

    @NotBlank(message = "组件类型不能为空")
    private String type;

    private String version;
    private String description;
    private String owner;
    private String status;
}
