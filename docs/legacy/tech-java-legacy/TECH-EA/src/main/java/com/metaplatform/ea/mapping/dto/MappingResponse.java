package com.metaplatform.ea.mapping.dto;

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
public class MappingResponse {

    private UUID id;
    private UUID capabilityId;
    private String conceptId;
    private String conceptCode;
    private String mappingType;
    private String metadata;
    private Instant createdAt;
    private Instant updatedAt;
}
