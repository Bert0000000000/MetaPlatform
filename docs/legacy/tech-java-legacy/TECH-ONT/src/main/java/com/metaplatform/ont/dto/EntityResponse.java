package com.metaplatform.ont.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EntityResponse {

    private String entityId;
    private String tenantId;
    private String conceptId;
    private String conceptName;
    private String code;
    private String name;
    private String description;
    private Map<String, EntityAttributeValueResponse> attributes;
    private Map<String, Object> metadata;
    private String status;
    private Instant createdAt;
    private Instant updatedAt;
    private String createdBy;
    private String updatedBy;
}
