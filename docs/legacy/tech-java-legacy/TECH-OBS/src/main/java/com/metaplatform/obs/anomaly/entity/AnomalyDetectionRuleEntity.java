package com.metaplatform.obs.anomaly.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
public class AnomalyDetectionRuleEntity {

    private UUID id;
    private String tenantId;
    private String name;
    private String metricType;
    private String conditionOperator;
    private double threshold;
    private int timeWindowSeconds;
    private String aggregationFunction;
    private String severity;
    private boolean enabled;
    private Instant createdAt;
    private Instant updatedAt;
    private Instant deletedAt;
}
