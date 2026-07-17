package com.metaplatform.obs.alert.dto;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AlertRuleRequest {

    private String name;

    @NotBlank(message = "metricName 不能为空")
    private String metricName;

    @NotBlank(message = "conditionOperator 不能为空")
    private String conditionOperator;

    private double threshold;
    private int durationSeconds;
    private String severity;
    private JsonNode notificationChannels;
    private Boolean enabled;
}