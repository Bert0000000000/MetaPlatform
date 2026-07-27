package com.metaplatform.ea.techarchitecture.dto;

import lombok.Data;

@Data
public class UpdateTechStackRequest {
    private String name;
    private String category;
    private String vendor;
    private String description;
    private String version;
    private String lifecycleStatus;
    private String metadata;
}