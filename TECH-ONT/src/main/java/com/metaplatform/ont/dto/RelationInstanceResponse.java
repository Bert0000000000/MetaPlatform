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
public class RelationInstanceResponse {

    private String relationInstanceId;
    private String tenantId;
    private String relationTypeId;
    private String relationTypeCode;
    private String sourceEntityId;
    private String sourceEntityName;
    private String targetEntityId;
    private String targetEntityName;
    private Map<String, Object> attributes;
    private Map<String, Object> metadata;
    private String status;
    private Instant createdAt;
    private Instant updatedAt;
    private String createdBy;
    private String updatedBy;
}