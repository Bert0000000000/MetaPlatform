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
import java.util.UUID;

@Repository
public interface ExecutionRepository extends JpaRepository<ExecutionEntity, UUID> {

    long countByTenantIdAndCreatedAtBetween(String tenantId, Instant start, Instant end);

    long countByTenantIdAndStatusAndCreatedAtBetween(String tenantId, String status, Instant start, Instant end);

    List<ExecutionEntity> findByTenantIdAndCreatedAtBetweenOrderByStartedAtDesc(String tenantId, Instant start, Instant end);

    @Query("SELECT e FROM ExecutionEntity e " +
           "WHERE e.tenantId = :tenantId " +
           "AND (:actionId IS NULL OR e.actionId = :actionId) " +
           "AND (:status IS NULL OR e.status = :status) " +
           "ORDER BY e.startedAt DESC")
    Page<ExecutionEntity> searchHistory(@Param("tenantId") String tenantId,
                                        @Param("actionId") String actionId,
                                        @Param("status") String status,
                                        Pageable pageable);
}

