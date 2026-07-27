package com.metaplatform.ea.ontmapping.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OntologyConceptSnapshot {

    private String conceptId;
    private String conceptCode;
    private String name;
    private String description;
    private String parentConceptId;
    private Map<String, Object> metadata;
}
