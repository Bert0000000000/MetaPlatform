package com.metaplatform.ea.capability.dto;

import lombok.Data;

import java.util.UUID;

@Data
public class UpdateCapabilityRequest {

    private String name;
    private String description;
    private UUID parentId;
    private Integer sortOrder;
    private String status;
    private String metadata;
}
