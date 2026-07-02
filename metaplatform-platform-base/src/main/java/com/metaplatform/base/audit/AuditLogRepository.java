package com.metaplatform.base.audit;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.UUID;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    /**
     * 只允许 INSERT，不允许 UPDATE/DELETE（通过 service 层约束）
     */

    Page<AuditLog> findByTenantIdAndUserIdOrderByTimestampDesc(
            UUID tenantId, UUID userId, Pageable pageable);

    Page<AuditLog> findByTenantIdAndResourceTypeAndResourceIdOrderByTimestampDesc(
            UUID tenantId, String resourceType, String resourceId, Pageable pageable);

    @Query("SELECT a FROM AuditLog a WHERE a.tenantId = :tenantId " +
           "AND a.timestamp BETWEEN :from AND :to ORDER BY a.timestamp DESC")
    Page<AuditLog> findByTenantAndTimeRange(
            @Param("tenantId") UUID tenantId,
            @Param("from") Instant from,
            @Param("to") Instant to,
            Pageable pageable);

    @Query("SELECT a FROM AuditLog a WHERE a.tenantId = :tenantId " +
           "AND a.action = :action ORDER BY a.timestamp DESC")
    Page<AuditLog> findByTenantAndAction(
            @Param("tenantId") UUID tenantId,
            @Param("action") String action,
            Pageable pageable);
}
