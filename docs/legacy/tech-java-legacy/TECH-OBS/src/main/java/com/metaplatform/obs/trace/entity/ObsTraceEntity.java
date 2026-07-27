package com.metaplatform.obs.trace.entity;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ObsTraceEntity {

    private UUID id;
    private String tenantId;
    private String traceId;
    private String spanId;
    private String parentSpanId;
    private String serviceName;
    private String operationName;
    private long startTimeUs;
    private long durationUs;
    private JsonNode tags;
    private JsonNode logs;
    private String status;
    private Instant createdAt;
}