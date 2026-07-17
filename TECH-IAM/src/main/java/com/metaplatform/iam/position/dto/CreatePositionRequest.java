package com.metaplatform.iam.position.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreatePositionRequest {

    @NotBlank(message = "name 不能为空")
    private String name;

    @NotBlank(message = "code 不能为空")
    private String code;

    private Integer level;

    private String parentId;

    private String description;
}