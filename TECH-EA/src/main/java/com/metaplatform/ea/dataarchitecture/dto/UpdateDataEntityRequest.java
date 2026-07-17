package com.metaplatform.ea.dataarchitecture.dto;

import lombok.Data;

import java.util.UUID;

@Data
public class UpdateDataEntityRequest {
    private String name;
    private String description;
    private String entityType;
    private String attributes;
    private UUID domainId;
}