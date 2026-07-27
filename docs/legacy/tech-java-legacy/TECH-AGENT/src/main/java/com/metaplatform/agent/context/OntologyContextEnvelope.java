package com.metaplatform.agent.context;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/** Server-built, signed and immutable context passed to runtimes and tools. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record OntologyContextEnvelope(
        String envelopeId,
        String tenantId,
        String userId,
        String runId,
        InteractionContext.Subject subject,
        String ontologyVersion,
        Map<String, Object> schema,
        List<String> metrics,
        List<String> allowedTools,
        List<String> allowedActions,
        Map<String, Object> dataScopes,
        String permissionSnapshotId,
        OffsetDateTime expiresAt,
        String signature,
        String contractVersion) {
    public OntologyContextEnvelope {
        require(envelopeId, "envelopeId"); require(tenantId, "tenantId");
        require(userId, "userId"); require(runId, "runId");
        require(ontologyVersion, "ontologyVersion"); require(permissionSnapshotId, "permissionSnapshotId");
        if (subject == null) throw new IllegalArgumentException("subject is required");
        if (expiresAt == null) throw new IllegalArgumentException("expiresAt is required");
        if (allowedTools == null) allowedTools = List.of();
        if (allowedActions == null) allowedActions = List.of();
        if (metrics == null) metrics = List.of();
    }

    public boolean isExpired(OffsetDateTime now) { return !expiresAt.isAfter(now); }
    public boolean allowsTool(String toolName) { return allowedTools.contains(toolName); }
    public boolean allowsAction(String actionCode) { return allowedActions.contains(actionCode); }

    private static void require(String value, String name) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(name + " is required");
    }
}
