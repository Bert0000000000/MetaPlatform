package com.metaplatform.ont.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.Map;

@Data
public class EntityAttributeBatchUpdateRequest {

    @NotNull(message = "属性值不能为空")
    private Map<String, Object> attributes;

    private Boolean validateConstraints;
}
