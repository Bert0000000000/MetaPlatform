package com.metaplatform.gw.audit.repository;

import com.metaplatform.gw.audit.entity.GwAuditLogEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface GwAuditLogRepository extends JpaRepository<GwAuditLogEntity, UUID> {

    @Query("SELECT a FROM GwAuditLogEntity a " +
           "WHERE (:tenantId IS NULL OR a.tenantId = :tenantId) " +
           "AND (:path IS NULL OR a.path LIKE %:path%) " +
           "AND (:method IS NULL OR a.method = :method) " +
           "AND (:statusCode IS NULL OR a.statusCode = :statusCode) " +
           "AND (:userId IS NULL OR a.userId = :userId) " +
           "AND (:traceId IS NULL OR a.traceId = :traceId) " +
           "AND (:isError IS NULL OR a.isError = :isError)")
    Page<GwAuditLogEntity> search(
            @Param("tenantId") String tenantId,
            @Param("path") String path,
            @Param("method") String method,
            @Param("statusCode") Integer statusCode,
            @Param("userId") String userId,
            @Param("traceId") String traceId,
            @Param("isError") Boolean isError,
            Pageable pageable);

    List<GwAuditLogEntity> findByTraceIdOrderByCreatedAtAsc(String traceId);

    @Query("SELECT a FROM GwAuditLogEntity a " +
           "WHERE (:tenantId IS NULL OR a.tenantId = :tenantId) " +
           "AND a.durationMs >= :thresholdMs " +
           "ORDER BY a.durationMs DESC")
    List<GwAuditLogEntity> findSlowRequests(
            @Param("tenantId") String tenantId,
            @Param("thresholdMs") long thresholdMs,
            Pageable pageable);

    @Query("SELECT a FROM GwAuditLogEntity a " +
           "WHERE (:tenantId IS NULL OR a.tenantId = :tenantId) " +
           "AND (:start IS NULL OR a.createdAt >= :start) " +
           "AND (:end IS NULL OR a.createdAt <= :end) " +
           "ORDER BY a.createdAt DESC")
    List<GwAuditLogEntity> exportRange(
            @Param("tenantId") String tenantId,
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end);

    @Query("SELECT a.path, COUNT(a), AVG(a.durationMs), MAX(a.durationMs), " +
           "SUM(CASE WHEN a.isError = TRUE THEN 1L ELSE 0L END) " +
           "FROM GwAuditLogEntity a " +
           "WHERE (:tenantId IS NULL OR a.tenantId = :tenantId) " +
           "AND (:start IS NULL OR a.createdAt >= :start) " +
           "AND (:end IS NULL OR a.createdAt <= :end) " +
           "GROUP BY a.path " +
           "ORDER BY COUNT(a) DESC")
    List<Object[]> aggregateLatency(
            @Param("tenantId") String tenantId,
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end,
            Pageable pageable);
}
