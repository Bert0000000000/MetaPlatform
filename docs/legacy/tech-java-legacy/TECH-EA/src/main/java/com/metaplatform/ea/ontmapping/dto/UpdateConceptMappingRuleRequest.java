package com.metaplatform.ea.ontmapping.dto;

import lombok.Data;

@Data
public class UpdateConceptMappingRuleRequest {

    private String assetType;

    private String conceptId;

    private String conceptCode;

    private String mappingType;

    private String description;

    private String metadata;
}
