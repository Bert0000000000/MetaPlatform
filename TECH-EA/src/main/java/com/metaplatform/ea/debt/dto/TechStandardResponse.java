package com.metaplatform.ea.debt.dto;

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
public class TechStandardResponse {
    private UUID id;
    private String tenantId;
    private String name;
    private String code;
    private String category;
    private String version;
    private String description;
    private Boolean mandatory;
    private String metadata;
    private Instant createdAt;
    private Instant updatedAt;
}