package com.metaplatform.obs.trace.dto;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Span {
    private String spanId;
    private String parentSpanId;
    private String serviceName;
    private String operationName;
    private long startTimeUs;
    private long durationUs;
    private String status;
    private JsonNode tags;
}