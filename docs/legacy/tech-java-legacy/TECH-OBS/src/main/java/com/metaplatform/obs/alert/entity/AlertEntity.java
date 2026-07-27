package com.metaplatform.obs.alert.entity;

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
public class AlertEntity {

    private UUID id;
    private UUID ruleId;
    private String tenantId;
    private Instant triggeredAt;
    private Instant resolvedAt;
    private double value;
    private String status;
    private String message;
}