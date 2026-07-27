package com.metaplatform.agent.context;

import java.util.List;
import java.util.Map;

/** Permission result resolved by IAM before an Agent run is built. */
public record PermissionSnapshot(
        String snapshotId,
        List<String> allowedTools,
        List<String> allowedActions,
        Map<String, Object> dataScopes,
        List<String> fieldsDenied) {
    public PermissionSnapshot {
        if (snapshotId == null || snapshotId.isBlank()) throw new IllegalArgumentException("snapshotId is required");
        allowedTools = allowedTools == null ? List.of() : List.copyOf(allowedTools);
        allowedActions = allowedActions == null ? List.of() : List.copyOf(allowedActions);
        dataScopes = dataScopes == null ? Map.of() : Map.copyOf(dataScopes);
        fieldsDenied = fieldsDenied == null ? List.of() : List.copyOf(fieldsDenied);
    }
}
