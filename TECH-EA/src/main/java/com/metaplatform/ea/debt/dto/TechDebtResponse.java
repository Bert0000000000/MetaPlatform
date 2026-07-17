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
public class TechDebtResponse {
    private UUID id;
    private String tenantId;
    private String title;
    private String code;
    private String category;
    private String severity;
    private String status;
    private String scopeType;
    private UUID scopeId;
    private String description;
    private Integer impactScore;
    private String remediation;
    private String estimatedEffort;
    private String owner;
    private String metadata;
    private Instant createdAt;
    private Instant updatedAt;
}