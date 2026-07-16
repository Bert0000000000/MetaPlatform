package com.metaplatform.ont.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class ConceptCreateRequest {

    @NotBlank(message = "概念编码不能为空")
    @Pattern(regexp = "^[A-Z][A-Z0-9_]*$", message = "概念编码必须以大写字母开头，仅包含大写字母、数字、下划线")
    @Size(max = 128, message = "概念编码长度不能超过 128")
    private String code;

    @NotBlank(message = "概念名称不能为空")
    @Size(max = 128, message = "概念名称长度不能超过 128")
    private String name;

    @Size(max = 1024, message = "描述长度不能超过 1024")
    private String description;

    @Size(max = 64, message = "父概念 ID 长度不能超过 64")
    private String parentConceptId;

    @Size(max = 64, message = "图标长度不能超过 64")
    private String icon;

    private Map<String, Object> metadata;

    private List<String> attributeIds;
}
