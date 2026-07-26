package com.metaplatform.agent.middleware;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface ActionRouteDlqRepository extends JpaRepository<ActionRouteDlqEntity, Long> {

    List<ActionRouteDlqEntity> findByTenantIdAndResolvedAtIsNull(String tenantId);

    List<ActionRouteDlqEntity> findByTenantIdAndResolvedAtIsNullOrderByFailedAtAsc(String tenantId);

    long countByResolvedAtIsNull();

    @Modifying
    @Query("update ActionRouteDlqEntity e set e.retryCount = e.retryCount + 1, e.lastRetryAt = :now, e.updatedAt = :now where e.id = :id")
    int incrementRetryCount(@Param("id") Long id, @Param("now") Instant now);

    @Modifying
    @Query("update ActionRouteDlqEntity e set e.resolvedAt = :now, e.resolvedStatus = :status, e.updatedAt = :now where e.id = :id")
    int markResolved(@Param("id") Long id, @Param("now") Instant now, @Param("status") String status);
}
