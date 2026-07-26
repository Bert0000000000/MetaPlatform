package com.metaplatform.agent.sandbox;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SandboxHandle {
    private String handleId;
    private String podName;
    private String tenantId;
    private String threadId;
    private String workspacePath;
    private Instant createdAt;
    private Instant expiresAt;
    private String status;   // PENDING / READY / FAILED / DESTROYED
}
