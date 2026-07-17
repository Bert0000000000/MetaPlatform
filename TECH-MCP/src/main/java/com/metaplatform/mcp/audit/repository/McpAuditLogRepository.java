package com.metaplatform.mcp.audit.repository;

import com.metaplatform.mcp.audit.entity.McpAuditLogEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface McpAuditLogRepository extends JpaRepository<McpAuditLogEntity, UUID> {

    @Query("SELECT a FROM McpAuditLogEntity a " +
           "WHERE a.tenantId = :tenantId " +
           "AND (:toolId IS NULL OR a.toolId = :toolId) " +
           "AND (:status IS NULL OR a.status = :status) " +
           "AND (:startTime IS NULL OR a.calledAt >= :startTime) " +
           "AND (:endTime IS NULL OR a.calledAt <= :endTime)")
    Page<McpAuditLogEntity> search(@Param("tenantId") String tenantId,
                                   @Param("toolId") UUID toolId,
                                   @Param("status") String status,
                                   @Param("startTime") Instant startTime,
                                   @Param("endTime") Instant endTime,
                                   Pageable pageable);

    @Query("SELECT a FROM McpAuditLogEntity a " +
           "WHERE a.tenantId = :tenantId " +
           "AND (:toolId IS NULL OR a.toolId = :toolId) " +
           "AND (:status IS NULL OR a.status = :status) " +
           "AND (:startTime IS NULL OR a.calledAt >= :startTime) " +
           "AND (:endTime IS NULL OR a.calledAt <= :endTime) " +
           "ORDER BY a.calledAt DESC")
    List<McpAuditLogEntity> findAllForExport(@Param("tenantId") String tenantId,
                                             @Param("toolId") UUID toolId,
                                             @Param("status") String status,
                                             @Param("startTime") Instant startTime,
                                             @Param("endTime") Instant endTime,
                                             Pageable pageable);

    @Query("SELECT a.status, COUNT(a) FROM McpAuditLogEntity a " +
           "WHERE a.tenantId = :tenantId " +
           "AND (:startTime IS NULL OR a.calledAt >= :startTime) " +
           "AND (:endTime IS NULL OR a.calledAt <= :endTime) " +
           "GROUP BY a.status")
    List<Object[]> countByStatus(@Param("tenantId") String tenantId,
                                 @Param("startTime") Instant startTime,
                                 @Param("endTime") Instant endTime);

    @Query("SELECT a.toolCode, COUNT(a) FROM McpAuditLogEntity a " +
           "WHERE a.tenantId = :tenantId " +
           "AND (:startTime IS NULL OR a.calledAt >= :startTime) " +
           "AND (:endTime IS NULL OR a.calledAt <= :endTime) " +
           "GROUP BY a.toolCode " +
           "ORDER BY COUNT(a) DESC")
    List<Object[]> countByTool(@Param("tenantId") String tenantId,
                               @Param("startTime") Instant startTime,
                               @Param("endTime") Instant endTime);

    @Query("SELECT COALESCE(SUM(a.inputTokens), 0), COALESCE(SUM(a.outputTokens), 0), " +
           "COALESCE(AVG(a.durationMs), 0) FROM McpAuditLogEntity a " +
           "WHERE a.tenantId = :tenantId " +
           "AND (:startTime IS NULL OR a.calledAt >= :startTime) " +
           "AND (:endTime IS NULL OR a.calledAt <= :endTime)")
    Object[] aggregate(@Param("tenantId") String tenantId,
                       @Param("startTime") Instant startTime,
                       @Param("endTime") Instant endTime);

    @Query("SELECT FUNCTION('date_trunc', :interval, a.calledAt), COUNT(a) " +
           "FROM McpAuditLogEntity a " +
           "WHERE a.tenantId = :tenantId " +
           "AND (:startTime IS NULL OR a.calledAt >= :startTime) " +
           "AND (:endTime IS NULL OR a.calledAt <= :endTime) " +
           "GROUP BY FUNCTION('date_trunc', :interval, a.calledAt) " +
           "ORDER BY FUNCTION('date_trunc', :interval, a.calledAt)")
    List<Object[]> trendByInterval(@Param("tenantId") String tenantId,
                                   @Param("interval") String interval,
                                   @Param("startTime") Instant startTime,
                                   @Param("endTime") Instant endTime);
}