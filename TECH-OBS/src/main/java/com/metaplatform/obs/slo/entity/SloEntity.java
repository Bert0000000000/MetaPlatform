package com.metaplatform.obs.slo.entity;

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
public class SloEntity {

    private UUID id;
    private String tenantId;
    private String name;
    private String description;
    private String serviceName;
    private String sliType;
    private String sliQuery;
    private double target;
    private String window;
    private Double errorBudgetTotal;
    private double errorBudgetConsumed;
    private double burnRate;
    private String status;
    private Instant createdAt;
    private Instant updatedAt;
    private Instant deletedAt;
}