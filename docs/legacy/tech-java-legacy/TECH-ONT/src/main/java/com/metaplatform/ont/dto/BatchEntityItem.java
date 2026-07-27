package com.metaplatform.ont.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.Map;

@Data
public class BatchEntityItem {

    @Size(max = 128, message = "实体编码长度不能超过 128")
    private String code;

    @NotBlank(message = "实体名称不能为空")
    @Size(max = 256, message = "实体名称长度不能超过 256")
    private String name;

    private Map<String, Object> attributeValues;
}
