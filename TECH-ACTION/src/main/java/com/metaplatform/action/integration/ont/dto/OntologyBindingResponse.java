package com.metaplatform.action.integration.ont.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OntologyBindingResponse {

    private String actionId;
    private String inputEntityId;
    private String outputEntityId;
    private List<OntologyBindingRequest.FieldMapping> fieldMappings;
    private Instant updatedAt;
}
