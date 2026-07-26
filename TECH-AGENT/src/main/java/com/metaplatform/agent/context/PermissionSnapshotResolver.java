package com.metaplatform.agent.context;

/** Resolves the server-side IAM permission snapshot for an interaction subject. */
@FunctionalInterface
public interface PermissionSnapshotResolver {
    PermissionSnapshot resolve(String tenantId, String userId, InteractionContext.Subject subject);
}
