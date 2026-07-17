package com.metaplatform.gw.audit.dto;

import com.metaplatform.gw.audit.entity.GwAuditAlertRuleEntity;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AlertRuleResponse {

    private UUID id;
    private String tenantId;
    private String name;
    private String conditionType;
    private Long thresholdMs;
    private Double thresholdErrorRate;
    private Long thresholdRps;
    private Boolean enabled;
    private Map<String, Object> notificationConfig;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static AlertRuleResponse fromEntity(GwAuditAlertRuleEntity entity) {
        return AlertRuleResponse.builder()
                .id(entity.getId())
                .tenantId(entity.getTenantId())
                .name(entity.getName())
                .conditionType(entity.getConditionType())
                .thresholdMs(entity.getThresholdMs())
                .thresholdErrorRate(entity.getThresholdErrorRate())
                .thresholdRps(entity.getThresholdRps())
                .enabled(entity.getEnabled())
                .notificationConfig(entity.getNotificationConfig())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}
