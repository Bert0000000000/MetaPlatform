package com.metaplatform.ea.mapping.dto;

import lombok.Data;

@Data
public class UpdateMappingRequest {

    private String mappingType;
    private String conceptCode;
    private String metadata;
}
