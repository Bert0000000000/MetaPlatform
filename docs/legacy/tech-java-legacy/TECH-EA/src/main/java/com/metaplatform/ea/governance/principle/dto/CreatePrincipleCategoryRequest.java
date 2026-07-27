package com.metaplatform.ea.governance.principle.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.UUID;

@Data
public class CreatePrincipleCategoryRequest {

    @NotBlank(message = "分类名称不能为空")
    private String name;

    @NotBlank(message = "分类编码不能为空")
    private String code;

    private UUID parentId;
    private String description;
    private Integer sortOrder;
    private String metadata;
}
