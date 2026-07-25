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

    // 使用 cast(:param as type) 解决 PostgreSQL 无法推断 NULL 参数类型的问题
    @Query("SELECT a FROM IamAuditLogEntity a WHERE "
            + "(cast(:tenantId as string) IS NULL OR a.tenantId = :tenantId) AND "
            + "(cast(:userId as string) IS NULL OR a.userId = :userId) AND "
            + "(cast(:action as string) IS NULL OR a.action = :action) AND "
            + "(cast(:resourceType as string) IS NULL OR a.resourceType = :resourceType) AND "
            + "(cast(:status as string) IS NULL OR a.status = :status) AND "
            + "(cast(:startTime as Instant) IS NULL OR a.createdAt >= :startTime) AND "
            + "(cast(:endTime as Instant) IS NULL OR a.createdAt <= :endTime)")
    Page<IamAuditLogEntity> search(@Param("tenantId") String tenantId,
                                    @Param("userId") String userId,
                                    @Param("action") IamAuditLogEntity.Action action,
                                    @Param("resourceType") String resourceType,
                                    @Param("status") IamAuditLogEntity.Status status,
                                    @Param("startTime") Instant startTime,
                                    @Param("endTime") Instant endTime,
                                    Pageable pageable);

    @Query("SELECT a.action, COUNT(a) FROM IamAuditLogEntity a WHERE "
            + "(cast(:tenantId as string) IS NULL OR a.tenantId = :tenantId) AND "
            + "(cast(:startTime as Instant) IS NULL OR a.createdAt >= :startTime) AND "
            + "(cast(:endTime as Instant) IS NULL OR a.createdAt <= :endTime) "
            + "GROUP BY a.action")
    List<Object[]> countByAction(@Param("tenantId") String tenantId,
                                  @Param("startTime") Instant startTime,
                                  @Param("endTime") Instant endTime);

    @Query("SELECT a.status, COUNT(a) FROM IamAuditLogEntity a WHERE "
            + "(cast(:tenantId as string) IS NULL OR a.tenantId = :tenantId) AND "
            + "(cast(:startTime as Instant) IS NULL OR a.createdAt >= :startTime) AND "
            + "(cast(:endTime as Instant) IS NULL OR a.createdAt <= :endTime) "
            + "GROUP BY a.status")
    List<Object[]> countByStatus(@Param("tenantId") String tenantId,
                                 @Param("startTime") Instant startTime,
                                 @Param("endTime") Instant endTime);
}