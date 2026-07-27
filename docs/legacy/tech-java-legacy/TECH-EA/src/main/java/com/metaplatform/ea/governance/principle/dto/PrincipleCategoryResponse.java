package com.metaplatform.ea.governance.principle.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PrincipleCategoryResponse {

    private UUID id;
    private String tenantId;
    private String name;
    private String code;
    private UUID parentId;
    private String description;
    private Integer sortOrder;
    private String metadata;
    private Instant createdAt;
    private Instant updatedAt;
}
