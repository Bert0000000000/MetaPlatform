package com.metaplatform.ont.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class AttributeUpdateRequest {

    @Size(max = 128, message = "属性名称长度不能超过 128")
    private String name;

    @Size(max = 1024, message = "描述长度不能超过 1024")
    private String description;

    private Boolean required;

    private Boolean unique;

    private Object defaultValue;

    private List<Map<String, String>> enumValues;

    private Map<String, Object> constraints;

    @Size(max = 32, message = "单位长度不能超过 32")
    private String unit;
}
