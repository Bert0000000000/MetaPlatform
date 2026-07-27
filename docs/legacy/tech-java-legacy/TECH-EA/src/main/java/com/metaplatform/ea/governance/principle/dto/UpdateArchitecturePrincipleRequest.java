package com.metaplatform.ea.governance.principle.dto;

import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class UpdateArchitecturePrincipleRequest {

    private String name;
    private String code;
    private UUID categoryId;
    private String description;
    private String priority;
    private String status;
    private List<String> standards;
    private String metadata;
}
