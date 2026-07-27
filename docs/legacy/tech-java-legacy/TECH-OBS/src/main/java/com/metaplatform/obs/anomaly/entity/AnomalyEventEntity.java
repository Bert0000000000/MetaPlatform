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
public class AnomalyEventEntity {

    private UUID id;
    private String tenantId;
    private UUID ruleId;
    private String anomalyType;
    private String severity;
    private String serviceName;
    private String traceId;
    private double metricValue;
    private String rootCause;
    private String remediationAction;
    private String status;
    private Instant detectedAt;
    private Instant resolvedAt;
    private Instant createdAt;
    private Instant updatedAt;
}
