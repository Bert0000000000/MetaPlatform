package com.metaplatform.ea.techarchitecture.dto;

import lombok.Data;

@Data
public class UpdateInfrastructureRequest {
    private String name;
    private String environment;
    private String region;
    private String description;
    private String metadata;
}