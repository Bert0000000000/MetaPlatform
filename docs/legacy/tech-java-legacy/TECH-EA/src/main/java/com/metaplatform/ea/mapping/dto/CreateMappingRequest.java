package com.metaplatform.ea.mapping.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class CreateMappingRequest {

    @NotNull(message = "capabilityId 不能为空")
    private UUID capabilityId;

    @NotBlank(message = "conceptId 不能为空")
    private String conceptId;

    private String conceptCode;

    @NotBlank(message = "mappingType 不能为空")
    private String mappingType;

    private String metadata;
}
