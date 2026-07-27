package com.metaplatform.ea.techarchitecture.dto;

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
public class TechStackResponse {
    private UUID id;
    private String tenantId;
    private String name;
    private String code;
    private String category;
    private String vendor;
    private String description;
    private String version;
    private String lifecycleStatus;
    private String metadata;
    private Instant createdAt;
    private Instant updatedAt;
}