package com.metaplatform.action.execution.repository;

import com.metaplatform.action.execution.entity.ExecutionEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ExecutionRepository extends JpaRepository<ExecutionEntity, UUID> {

    long countByTenantIdAndCreatedAtBetween(String tenantId, Instant start, Instant end);

    long countByTenantIdAndStatusAndCreatedAtBetween(String tenantId, String status, Instant start, Instant end);

    List<ExecutionEntity> findByTenantIdAndCreatedAtBetweenOrderByStartedAtDesc(String tenantId, Instant start, Instant end);

    Optional<ExecutionEntity> findByExecutionIdAndTenantId(String executionId, String tenantId);

    @Query("SELECT e FROM ExecutionEntity e " +
           "WHERE e.tenantId = :tenantId " +
           "AND (:actionId IS NULL OR e.actionId = :actionId) " +
           "AND (:status IS NULL OR e.status = :status) " +
           "ORDER BY e.startedAt DESC")
    Page<ExecutionEntity> searchHistory(@Param("tenantId") String tenantId,
                                        @Param("actionId") String actionId,
                                        @Param("status") String status,
                                        Pageable pageable);

    /**
     * 多条件分页查询（含时间范围）。
     */
    @Query("SELECT e FROM ExecutionEntity e " +
           "WHERE e.tenantId = :tenantId " +
           "AND (:actionId IS NULL OR e.actionId = :actionId) " +
           "AND (:status IS NULL OR e.status = :status) " +
           "AND (:startTime IS NULL OR e.startedAt >= :startTime) " +
           "AND (:endTime IS NULL OR e.startedAt <= :endTime) " +
           "ORDER BY e.startedAt DESC")
    Page<ExecutionEntity> searchExecutions(@Param("tenantId") String tenantId,
                                            @Param("actionId") String actionId,
                                            @Param("status") String status,
                                            @Param("startTime") Instant startTime,
                                            @Param("endTime") Instant endTime,
                                            Pageable pageable);

    List<ExecutionEntity> findByTenantIdAndRetryOfOrderByCreatedAtDesc(String tenantId, String retryOf);
}

