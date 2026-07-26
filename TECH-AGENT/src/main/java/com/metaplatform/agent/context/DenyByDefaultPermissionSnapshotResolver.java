package com.metaplatform.agent.context;

import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/** Temporary local resolver used until the TECH-IAM client contract is wired. Deny by default. */
@Component
public class DenyByDefaultPermissionSnapshotResolver implements PermissionSnapshotResolver {
    @Override
    public PermissionSnapshot resolve(String tenantId, String userId, InteractionContext.Subject subject) {
        if (tenantId == null || tenantId.isBlank() || userId == null || userId.isBlank() || subject == null) {
            throw new IllegalArgumentException("tenant, user and subject are required");
        }
        return new PermissionSnapshot("perm-pending-" + tenantId + "-" + userId,
                List.of(), List.of(), Map.of("fieldsDenied", List.of("*")), List.of("*"));
    }
}
