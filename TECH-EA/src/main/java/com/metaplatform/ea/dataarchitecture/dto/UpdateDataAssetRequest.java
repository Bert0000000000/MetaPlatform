package com.metaplatform.ea.dataarchitecture.dto;

import lombok.Data;

import java.util.UUID;

@Data
public class UpdateDataAssetRequest {
    private String name;
    private String description;
    private UUID entityId;
    private String classification;
    private String metadata;
}