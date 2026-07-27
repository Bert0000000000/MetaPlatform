package com.metaplatform.ont.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class RelationTypeUpdateRequest {

    @Size(max = 128, message = "关系类型名称长度不能超过 128")
    private String name;

    @Size(max = 1024, message = "描述长度不能超过 1024")
    private String description;

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