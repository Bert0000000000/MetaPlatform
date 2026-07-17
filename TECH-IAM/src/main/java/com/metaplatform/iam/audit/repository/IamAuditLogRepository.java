package com.metaplatform.iam.audit.repository;

import com.metaplatform.iam.audit.entity.IamAuditLogEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface IamAuditLogRepository
        extends JpaRepository<IamAuditLogEntity, String>, JpaSpecificationExecutor<IamAuditLogEntity> {

    @Query("SELECT a FROM IamAuditLogEntity a WHERE "
            + "(:tenantId IS NULL OR a.tenantId = :tenantId) AND "
            + "(:userId IS NULL OR a.userId = :userId) AND "
            + "(:action IS NULL OR a.action = :action) AND "
            + "(:resourceType IS NULL OR a.resourceType = :resourceType) AND "
            + "(:status IS NULL OR a.status = :status) AND "
            + "(:startTime IS NULL OR a.createdAt >= :startTime) AND "
            + "(:endTime IS NULL OR a.createdAt <= :endTime)")
    Page<IamAuditLogEntity> search(@Param("tenantId") String tenantId,
                                    @Param("userId") String userId,
                                    @Param("action") IamAuditLogEntity.Action action,
                                    @Param("resourceType") String resourceType,
                                    @Param("status") IamAuditLogEntity.Status status,
                                    @Param("startTime") Instant startTime,
                                    @Param("endTime") Instant endTime,
                                    Pageable pageable);

    @Query("SELECT a.action, COUNT(a) FROM IamAuditLogEntity a WHERE "
            + "(:tenantId IS NULL OR a.tenantId = :tenantId) AND "
            + "(:startTime IS NULL OR a.createdAt >= :startTime) AND "
            + "(:endTime IS NULL OR a.createdAt <= :endTime) "
            + "GROUP BY a.action")
    List<Object[]> countByAction(@Param("tenantId") String tenantId,
                                  @Param("startTime") Instant startTime,
                                  @Param("endTime") Instant endTime);

    @Query("SELECT a.status, COUNT(a) FROM IamAuditLogEntity a WHERE "
            + "(:tenantId IS NULL OR a.tenantId = :tenantId) AND "
            + "(:startTime IS NULL OR a.createdAt >= :startTime) AND "
            + "(:endTime IS NULL OR a.createdAt <= :endTime) "
            + "GROUP BY a.status")
    List<Object[]> countByStatus(@Param("tenantId") String tenantId,
                                  @Param("startTime") Instant startTime,
                                  @Param("endTime") Instant endTime);
}