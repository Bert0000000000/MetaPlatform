package com.metaplatform.ont.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.Map;

@Data
public class EntityCreateRequest {

    @NotBlank(message = "所属概念 ID 不能为空")
    @Size(max = 64, message = "概念 ID 长度不能超过 64")
    private String conceptId;

    @NotBlank(message = "实体名称不能为空")
    @Size(max = 256, message = "实体名称长度不能超过 256")
    private String name;

    @Size(max = 128, message = "实体编码长度不能超过 128")
    private String code;

    @Size(max = 1024, message = "描述长度不能超过 1024")
    private String description;

    private Map<String, Object> attributes;

    private Map<String, Object> metadata;
}
