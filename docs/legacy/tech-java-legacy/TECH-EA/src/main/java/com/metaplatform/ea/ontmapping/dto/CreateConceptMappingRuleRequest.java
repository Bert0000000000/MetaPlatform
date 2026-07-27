package com.metaplatform.ea.ontmapping.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class CreateConceptMappingRuleRequest {

    @NotBlank(message = "assetType 不能为空")
    private String assetType;

    @NotNull(message = "assetId 不能为空")
    private UUID assetId;

    private String assetName;

    @NotBlank(message = "conceptId 不能为空")
    private String conceptId;

    private String conceptCode;

    @NotBlank(message = "mappingType 不能为空")
    private String mappingType;

    private String description;

    private String metadata;
}
