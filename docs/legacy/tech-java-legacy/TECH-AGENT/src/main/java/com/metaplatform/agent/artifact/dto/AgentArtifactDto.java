package com.metaplatform.agent.artifact.dto;

import lombok.*;
import java.time.Instant;
import java.util.List;
import java.util.Map;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class AgentArtifactDto {
    private String artifactId;
    private String runId;
    private String tenantId;
    private String filename;
    private String contentType;
    private Long sizeBytes;
    private String sha256;
    private String minioKey;
    private String scanStatus;
    private List<String> flaggedReasons;
    private Map<String, Object> producedBy;
    private List<String> evidenceRefs;
    private Instant createdAt;
    private Instant expiresAt;
    private String signedUrl;
    private boolean revoked;
}
