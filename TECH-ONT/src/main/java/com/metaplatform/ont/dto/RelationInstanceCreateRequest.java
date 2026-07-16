package com.metaplatform.ont.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.Map;

@Data
public class RelationInstanceCreateRequest {

    @NotBlank(message = "关系类型 ID 不能为空")
    @Size(max = 64, message = "关系类型 ID 长度不能超过 64")
    private String relationTypeId;

    @NotBlank(message = "源实体 ID 不能为空")
    @Size(max = 64, message = "源实体 ID 长度不能超过 64")
    private String sourceEntityId;

    @NotBlank(message = "目标实体 ID 不能为空")
    @Size(max = 64, message = "目标实体 ID 长度不能超过 64")
    private String targetEntityId;

    private Map<String, Object> attributes;

    private Map<String, Object> metadata;
}