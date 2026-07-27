package com.metaplatform.ea.dataarchitecture.dto;

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
public class DataStandardResponse {
    private UUID id;
    private String tenantId;
    private String code;
    private String name;
    private String standardType;
    private String rule;
    private String description;
    private Instant createdAt;
    private Instant updatedAt;
}
