package com.metaplatform.obs.anomaly.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AnomalyRuleRequest {

    private String name;

    @NotBlank(message = "metricType 不能为空")
    private String metricType;

    @NotBlank(message = "conditionOperator 不能为空")
    private String conditionOperator;

    @NotNull(message = "threshold 不能为空")
    private Double threshold;

    private Integer timeWindowSeconds;

    @NotBlank(message = "aggregationFunction 不能为空")
    private String aggregationFunction;

    private String severity;

    private Boolean enabled;
}
