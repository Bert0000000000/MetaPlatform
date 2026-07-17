package com.metaplatform.iam.audit.dto;

import com.metaplatform.iam.audit.entity.IamAuditLogEntity;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuditLogResponse {

    private String id;
    private String tenantId;
    private String userId;
    private IamAuditLogEntity.Action action;
    private String resourceType;
    private String resourceId;
    private String description;
    private String ipAddress;
    private String userAgent;
    private String traceId;
    private IamAuditLogEntity.Status status;
    private String metadata;
    private Instant createdAt;
}
