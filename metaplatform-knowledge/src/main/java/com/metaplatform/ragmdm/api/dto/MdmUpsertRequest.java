package com.metaplatform.ragmdm.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.Map;

@Data
public class MdmUpsertRequest {

    @NotBlank(message = "Entity type must not be blank")
    private String entityType;

    @NotBlank(message = "Source system must not be blank")
    private String sourceSystem;

    @NotBlank(message = "Source ID must not be blank")
    private String sourceId;

    @NotNull(message = "Source data must not be null")
    private Map<String, Object> sourceData;
}
