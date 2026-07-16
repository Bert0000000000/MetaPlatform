package com.metaplatform.obs.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LogEntry {

    private Instant timestamp;
    private String serviceName;
    private String level;
    private String traceId;
    private String message;
    private Map<String, String> labels;
}
