package com.metaplatform.agent.evidence.dto;

import lombok.*;
import java.time.Instant;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class EvidenceDto {
    private String evidenceId;
    private String type;
    private String ref;
    private String fragment;
    private String sourceUri;
    private Instant capturedAt;
    private String capturedBy;
    private String concept;
    private String objectId;
    private String toolCallId;
    private String envelopeId;
}
