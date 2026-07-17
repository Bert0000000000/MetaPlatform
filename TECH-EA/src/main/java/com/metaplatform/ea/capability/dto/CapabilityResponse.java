package com.metaplatform.ea.capability.dto;

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
public class CapabilityResponse {

    private UUID id;
    private String name;
    private String code;
    private String description;
    private UUID parentId;
    private Integer level;
    private Integer sortOrder;
    private String status;
    private String metadata;
    private Instant createdAt;
    private Instant updatedAt;
}
