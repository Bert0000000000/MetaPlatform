package com.metaplatform.ea.dataarchitecture.dto;

import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class UpdateDataEntityRequest {
    private String name;
    private String description;
    private String entityType;
    private List<DataField> fields;
    private UUID domainId;
}
