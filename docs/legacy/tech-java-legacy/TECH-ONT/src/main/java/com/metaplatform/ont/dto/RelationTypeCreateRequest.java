package com.metaplatform.ont.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class RelationTypeCreateRequest {

    @NotBlank(message = "关系类型名称不能为空")
    @Size(max = 128, message = "关系类型名称长度不能超过 128")
    private String name;

    @NotBlank(message = "关系类型编码不能为空")
    @Pattern(regexp = "^[A-Z][A-Z0-9_]*$", message = "关系类型编码必须以大写字母开头，仅包含大写字母、数字、下划线")
    @Size(max = 128, message = "关系类型编码长度不能超过 128")
    private String code;

    @Size(max = 1024, message = "描述长度不能超过 1024")
    private String description;

    @NotBlank(message = "源概念 ID 不能为空")
    @Size(max = 64, message = "源概念 ID 长度不能超过 64")
    private String sourceConceptId;

    @NotBlank(message = "目标概念 ID 不能为空")
    @Size(max = 64, message = "目标概念 ID 长度不能超过 64")
    private String targetConceptId;

    @Size(max = 32, message = "direction 长度不能超过 32")
    private String direction;

    @Size(max = 32, message = "cardinality 长度不能超过 32")
    private String cardinality;

    private Integer minCardinality;

    private Integer maxCardinality;

    private Boolean symmetric;

    private Boolean transitive;

    private List<String> attributeIds;
}