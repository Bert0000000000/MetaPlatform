package com.metaplatform.ea.capability.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.UUID;

@Data
public class CreateCapabilityRequest {

    @NotBlank(message = "name 不能为空")
    private String name;

    @NotBlank(message = "code 不能为空")
    private String code;

    private String description;

    private UUID parentId;

    private Integer sortOrder;

    private String metadata;
}
