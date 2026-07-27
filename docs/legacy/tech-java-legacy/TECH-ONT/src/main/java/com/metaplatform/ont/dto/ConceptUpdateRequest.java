package com.metaplatform.ont.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class ConceptUpdateRequest {

    @Size(max = 128, message = "概念名称长度不能超过 128")
    private String name;

    @Size(max = 1024, message = "描述长度不能超过 1024")
    private String description;

    @Size(max = 64, message = "图标长度不能超过 64")
    private String icon;

    private Map<String, Object> metadata;

    private List<String> attributeIds;
}
