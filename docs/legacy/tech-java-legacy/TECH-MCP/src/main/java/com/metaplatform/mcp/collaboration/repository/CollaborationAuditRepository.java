package com.metaplatform.mcp.collaboration.repository;

import com.metaplatform.mcp.collaboration.entity.CollaborationAuditEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CollaborationAuditRepository extends JpaRepository<CollaborationAuditEntity, UUID> {

    @Query("SELECT c FROM CollaborationAuditEntity c " +
           "WHERE c.tenantId = :tenantId " +
           "AND (:callerId IS NULL OR c.callerId = :callerId) " +
           "AND (:calleeId IS NULL OR c.calleeId = :calleeId) " +
           "AND (:protocolType IS NULL OR c.protocolType = :protocolType) " +
           "AND (:status IS NULL OR c.status = :status) " +
           "AND (:startTime IS NULL OR c.calledAt >= :startTime) " +
           "AND (:endTime IS NULL OR c.calledAt <= :endTime) " +
           "AND (:traceId IS NULL OR c.traceId = :traceId) " +
           "ORDER BY c.calledAt DESC")
    Page<CollaborationAuditEntity> search(@Param("tenantId") String tenantId,
                                          @Param("callerId") String callerId,
                                          @Param("calleeId") String calleeId,
                                          @Param("protocolType") String protocolType,
                                          @Param("status") String status,
                                          @Param("startTime") Instant startTime,
                                          @Param("endTime") Instant endTime,
                                          @Param("traceId") String traceId,
                                          Pageable pageable);

    Optional<CollaborationAuditEntity> findByIdAndTenantId(UUID id, String tenantId);
}
