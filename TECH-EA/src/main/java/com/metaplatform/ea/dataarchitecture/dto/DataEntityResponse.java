package com.metaplatform.ea.dataarchitecture.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DataEntityResponse {
    private UUID id;
    private String tenantId;
    private UUID domainId;
    private String name;
    private String code;
    private String description;
    private String entityType;
    private List<DataField> fields;
    private Instant createdAt;
    private Instant updatedAt;
}
