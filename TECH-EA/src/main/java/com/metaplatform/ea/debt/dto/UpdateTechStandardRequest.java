package com.metaplatform.ea.debt.dto;

import lombok.Data;

@Data
public class UpdateTechStandardRequest {
    private String name;
    private String category;
    private String version;
    private String description;
    private Boolean mandatory;
    private String metadata;
}