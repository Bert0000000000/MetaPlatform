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
public class DataDomainResponse {
    private UUID id;
    private String tenantId;
    private String name;
    private String code;
    private String description;
    private String owner;
    private String metadata;
    private Instant createdAt;
    private Instant updatedAt;
}