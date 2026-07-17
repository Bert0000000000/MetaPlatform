package com.metaplatform.action.integration.ont.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class OntologyBindingRequest {

    private String inputEntityId;

    private String outputEntityId;

    @NotNull(message = "fieldMappings 不能为空")
    private List<FieldMapping> fieldMappings;

    @Data
    public static class FieldMapping {
        private String source;
        private String target;
    }
}
