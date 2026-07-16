package com.metaplatform.base.interfaces.rest.dto;

import java.time.Instant;

public record AuditLogResponse(
    Long id,
    String tenantId,
    String userId,
    String action,
    String resourceType,
    String resourceId,
    String details,
    Instant timestamp,
    String ipAddress
) {}
