package com.metaplatform.base.interfaces.rest;

import com.metaplatform.base.audit.AuditLog;
import com.metaplatform.base.audit.AuditLogRepository;
import com.metaplatform.base.interfaces.rest.dto.AuditLogResponse;
import com.metaplatform.base.tenant.TenantContext;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/audit")
public class AuditController {

    private final AuditLogRepository auditLogRepository;

    public AuditController(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    @GetMapping
    public ResponseEntity<Page<AuditLogResponse>> query(
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String resourceType,
            @RequestParam(required = false) String resourceId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        UUID tenantId = TenantContext.get().value();
        PageRequest pageRequest = PageRequest.of(page, size);

        Page<AuditLog> result;
        if (userId != null) {
            result = auditLogRepository.findByTenantIdAndUserIdOrderByTimestampDesc(
                    tenantId, UUID.fromString(userId), pageRequest);
        } else if (resourceType != null && resourceId != null) {
            result = auditLogRepository.findByTenantIdAndResourceTypeAndResourceIdOrderByTimestampDesc(
                    tenantId, resourceType, resourceId, pageRequest);
        } else if (from != null && to != null) {
            result = auditLogRepository.findByTenantAndTimeRange(tenantId, from, to, pageRequest);
        } else if (action != null) {
            result = auditLogRepository.findByTenantAndAction(tenantId, action, pageRequest);
        } else {
            result = auditLogRepository.findByTenantAndTimeRange(
                    tenantId, Instant.now().minus(java.time.Duration.ofDays(7)), Instant.now(), pageRequest);
        }

        return ResponseEntity.ok(result.map(this::toResponse));
    }

    private AuditLogResponse toResponse(AuditLog log) {
        return new AuditLogResponse(
                log.getId(),
                log.getTenantId().toString(),
                log.getUserId().toString(),
                log.getAction(),
                log.getResourceType(),
                log.getResourceId(),
                log.getDetails(),
                log.getTimestamp(),
                log.getIpAddress()
        );
    }
}
