package com.metaplatform.agent.runtime;

import java.util.List;
import java.util.Map;

/** Canonical response envelope shared by Native and DeerFlow runtimes. */
public record UnifiedRuntimeResponse(
        String runId, String status, String content,
        List<Map<String, Object>> claims, List<Map<String, Object>> evidence,
        List<Map<String, Object>> events, Map<String, Object> metadata) {
    public UnifiedRuntimeResponse {
        claims = claims == null ? List.of() : List.copyOf(claims);
        evidence = evidence == null ? List.of() : List.copyOf(evidence);
        events = events == null ? List.of() : List.copyOf(events);
        metadata = metadata == null ? Map.of() : Map.copyOf(metadata);
    }
    public boolean successful() { return "SUCCESS".equals(status) || "COMPLETED".equals(status); }
}
