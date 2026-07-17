package com.metaplatform.gw.audit.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateAlertRuleRequest {

    @NotBlank(message = "name 不能为空")
    private String name;

    @NotBlank(message = "conditionType 不能为空")
    @Pattern(regexp = "SLOW_REQUEST|HIGH_ERROR_RATE|HIGH_TRAFFIC",
            message = "conditionType 必须为 SLOW_REQUEST / HIGH_ERROR_RATE / HIGH_TRAFFIC 之一")
    private String conditionType;

    private Long thresholdMs;
    private Double thresholdErrorRate;
    private Long thresholdRps;
    private Boolean enabled;
    private String tenantId;
    private Map<String, Object> notificationConfig;
}
