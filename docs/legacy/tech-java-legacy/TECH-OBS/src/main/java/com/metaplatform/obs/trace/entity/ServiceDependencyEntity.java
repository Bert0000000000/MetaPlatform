package com.metaplatform.obs.trace.entity;

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
public class ServiceDependencyEntity {

    private UUID id;
    private String tenantId;
    private String sourceService;
    private String targetService;
    private long callCount;
    private double avgDurationMs;
    private Instant updatedAt;
}