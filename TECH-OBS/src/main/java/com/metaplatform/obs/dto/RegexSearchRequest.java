package com.metaplatform.obs.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.OffsetDateTime;

@Data
public class RegexSearchRequest {

    @NotBlank(message = "pattern 不能为空")
    private String pattern;

    private String tenantId;

    private String service;

    private String level;

    @NotNull(message = "startTime 不能为空")
    @JsonFormat(shape = JsonFormat.Shape.STRING)
    private OffsetDateTime startTime;

    @NotNull(message = "endTime 不能为空")
    @JsonFormat(shape = JsonFormat.Shape.STRING)
    private OffsetDateTime endTime;

    @Min(value = 1, message = "page 必须大于等于 1")
    private Integer page = 1;

    @Min(value = 1, message = "size 必须大于等于 1")
    private Integer size = 50;
}
