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
public class AlertSilenceEntity {

    private UUID id;
    private UUID alertId;
    private String tenantId;
    private Instant silencedUntil;
    private String reason;
    private String createdBy;
    private Instant createdAt;
}