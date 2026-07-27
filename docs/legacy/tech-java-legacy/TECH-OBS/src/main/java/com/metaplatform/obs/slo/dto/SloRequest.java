package com.metaplatform.obs.slo.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SloRequest {

    private String name;
    private String description;

    @NotBlank(message = "serviceName 不能为空")
    private String serviceName;

    @NotBlank(message = "sliType 不能为空")
    private String sliType;

    @NotBlank(message = "sliQuery 不能为空")
    private String sliQuery;

    @DecimalMin(value = "0.0", message = "target 必须大于等于 0")
    @DecimalMax(value = "100.0", message = "target 不能超过 100")
    private double target;
    private String window;
}