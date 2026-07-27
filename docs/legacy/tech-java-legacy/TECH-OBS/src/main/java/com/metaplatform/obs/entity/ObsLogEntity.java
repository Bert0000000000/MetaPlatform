package com.metaplatform.obs.entity;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ObsLogEntity {

    private String id;
    private String tenantId;
    private String serviceName;
    private String level;
    private String traceId;
    private String message;
    private JsonNode labels;
    private Instant createdAt;
}
