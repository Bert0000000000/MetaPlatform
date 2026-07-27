package com.metaplatform.data.monitoring.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.Map;

/**
 * 告警响应。
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AlertResponse {

    private String alertId;
    private String tenantId;
    private String severity;
    private String component;
    private String title;
    private String description;
    private String status;
    private Map<String, Object> context;
    private String acknowledgedBy;
    private OffsetDateTime triggeredAt;
    private OffsetDateTime acknowledgedAt;
    private OffsetDateTime resolvedAt;
}
