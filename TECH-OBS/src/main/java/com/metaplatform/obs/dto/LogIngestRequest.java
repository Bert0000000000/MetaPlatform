package com.metaplatform.obs.dto;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.Instant;

@Data
public class LogIngestRequest {

    @NotBlank(message = "serviceName 不能为空")
    private String serviceName;

    @NotBlank(message = "level 不能为空")
    private String level;

    private String traceId;

    @NotNull(message = "message 不能为空")
    private String message;

    private Instant timestamp;

    private JsonNode labels;
}
