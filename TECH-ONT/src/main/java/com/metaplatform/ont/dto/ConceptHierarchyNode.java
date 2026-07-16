package com.metaplatform.ont.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConceptHierarchyNode {

    private String conceptId;
    private String code;
    private String name;
    private Integer depth;
    private String parentConceptId;
}