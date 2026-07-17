package com.metaplatform.obs.topology.entity;

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
public class ServiceHealthEntity {

    private UUID id;
    private String serviceName;
    private String tenantId;
    private String status;
    private Instant lastCheckAt;
    private double responseTimeMs;
    private double errorRate;
}