package com.metaplatform.ea.governance.principle.dto;

import lombok.Data;

import java.util.UUID;

@Data
public class UpdatePrincipleCategoryRequest {

    private String name;
    private String code;
    private UUID parentId;
    private String description;
    private Integer sortOrder;
    private String metadata;
}
