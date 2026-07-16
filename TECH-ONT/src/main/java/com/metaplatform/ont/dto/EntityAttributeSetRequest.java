package com.metaplatform.ont.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class EntityAttributeSetRequest {

    @NotBlank(message = "属性 ID 不能为空")
    private String attributeId;

    @NotNull(message = "属性值不能为空")
    private Object value;
}