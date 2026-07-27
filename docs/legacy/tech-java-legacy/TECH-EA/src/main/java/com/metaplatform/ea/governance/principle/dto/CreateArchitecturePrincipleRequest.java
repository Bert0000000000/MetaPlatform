package com.metaplatform.ea.governance.principle.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class CreateArchitecturePrincipleRequest {

    @NotBlank(message = "原则名称不能为空")
    private String name;

    @NotBlank(message = "原则编码不能为空")
    private String code;

    private UUID categoryId;
    private String description;
    private String priority;
    private String status;
    private List<String> standards;
    private String metadata;
}
