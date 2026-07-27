package com.metaplatform.agent.sandbox;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SandboxResult {
    private int exitCode;
    private String stdout;
    private String stderr;
    private long durationMs;
    private boolean timedOut;
}
