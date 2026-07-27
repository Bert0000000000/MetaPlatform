package com.metaplatform.agent.events.dto;

import lombok.*;
import java.time.Instant;
import java.util.Map;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class RunEventDto {
    private String eventId;
    private String runId;
    private String taskId;
    private String subAgentId;
    private String parentRunId;
    private String type;
    private Instant ts;
    private String traceId;
    private String tenantId;
    private String envelopeId;
    private Long seq;
    private Map<String, Object> payload;
}
