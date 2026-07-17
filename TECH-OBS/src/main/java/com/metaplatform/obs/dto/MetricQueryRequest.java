package com.metaplatform.obs.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.Map;

@Data
public class MetricQueryRequest {

    @NotBlank(message = "metricName 不能为空")
    private String metricName;

    private Map<String, String> labels;

    @NotNull(message = "startTime 不能为空")
    @JsonFormat(shape = JsonFormat.Shape.STRING)
    private OffsetDateTime startTime;

    @NotNull(message = "endTime 不能为空")
    @JsonFormat(shape = JsonFormat.Shape.STRING)
    private OffsetDateTime endTime;

    @NotBlank(message = "step 不能为空")
    private String step;
}
