package com.metaplatform.obs.alert.entity;

import com.fasterxml.jackson.databind.JsonNode;
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
public class AlertRuleEntity {

    private UUID id;
    private String tenantId;
    private String name;
    private String metricName;
    private String conditionOperator;
    private double threshold;
    private int durationSeconds;
    private String severity;
    private JsonNode notificationChannels;
    private boolean enabled;
    private Instant createdAt;
    private Instant updatedAt;
    private Instant deletedAt;
}