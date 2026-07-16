package com.metaplatform.ont.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class AttributeCreateRequest {

    @NotBlank(message = "属性编码不能为空")
    @Pattern(regexp = "^[A-Z][A-Z0-9_]*$", message = "属性编码必须以大写字母开头，仅包含大写字母、数字、下划线")
    @Size(max = 128, message = "属性编码长度不能超过 128")
    private String code;

    @NotBlank(message = "属性名称不能为空")
    @Size(max = 128, message = "属性名称长度不能超过 128")
    private String name;

    @Size(max = 1024, message = "描述长度不能超过 1024")
    private String description;

    @NotBlank(message = "数据类型不能为空")
    @Size(max = 32, message = "数据类型长度不能超过 32")
    private String dataType;

    private Boolean required;

    private Boolean unique;

    private Object defaultValue;

    private List<Map<String, String>> enumValues;

    private Map<String, Object> constraints;

    @Size(max = 32, message = "单位长度不能超过 32")
    private String unit;
}
