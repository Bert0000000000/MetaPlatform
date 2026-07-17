package com.metaplatform.iam.position.dto;

import lombok.Data;

@Data
public class UpdatePositionRequest {

    private String name;
    private Integer level;
    private String parentId;
    private String description;
    private Integer version;
}