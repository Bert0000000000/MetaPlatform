package com.metaplatform.agent.artifact.dto;

import lombok.*;
import java.time.Instant;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class SignedUrlResponse {
    private String signedUrl;
    private Instant expiresAt;
}
