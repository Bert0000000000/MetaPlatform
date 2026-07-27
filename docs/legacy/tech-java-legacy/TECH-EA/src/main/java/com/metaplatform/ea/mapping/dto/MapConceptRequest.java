package com.metaplatform.ea.mapping.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class MapConceptRequest {

    @NotBlank(message = "conceptId 不能为空")
    private String conceptId;

    private String conceptCode;

    @NotBlank(message = "mappingType 不能为空")
    private String mappingType;

    private String metadata;
}
