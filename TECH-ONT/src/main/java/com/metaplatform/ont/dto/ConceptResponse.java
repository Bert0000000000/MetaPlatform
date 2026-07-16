package com.metaplatform.ont.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConceptResponse {

    private String conceptId;
    private String tenantId;
    private String code;
    private String name;
    private String description;
    private String parentConceptId;
    private String icon;
    private Map<String, Object> metadata;
    private Integer depth;
    private Integer level;
    private String path;
    private String status;
    private List<String> attributeIds;
    private Long entityCount;
    private Long childCount;
    private Instant createdAt;
    private Instant updatedAt;
    private String createdBy;
    private String updatedBy;
}
