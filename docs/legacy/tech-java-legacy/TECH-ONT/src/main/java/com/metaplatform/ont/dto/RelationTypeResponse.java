package com.metaplatform.ont.dto;

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
public class RelationTypeResponse {

    private String relationTypeId;
    private String tenantId;
    private String code;
    private String name;
    private String description;
    private String sourceConceptId;
    private String sourceConceptName;
    private String targetConceptId;
    private String targetConceptName;
    private String direction;
    private String cardinality;
    private Integer minCardinality;
    private Integer maxCardinality;
    private Boolean symmetric;
    private Boolean transitive;
    private List<String> attributeIds;
    private Long instanceCount;
    private Instant createdAt;
    private Instant updatedAt;
    private String createdBy;
    private String updatedBy;
}