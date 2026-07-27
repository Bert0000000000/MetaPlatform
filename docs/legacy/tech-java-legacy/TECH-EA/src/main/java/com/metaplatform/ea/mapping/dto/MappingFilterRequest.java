package com.metaplatform.ea.mapping.dto;

import lombok.Data;

@Data
public class MappingFilterRequest {
    private String mappingType;
    private String keyword;
}