package com.metaplatform.a2a.repository;

import com.metaplatform.a2a.entity.AuditRecordEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 审计记录仓储。
 *
 * <p>对应 Python {@code app.audit.repository.AuditRepository}。</p>
 */
@Repository
public interface AuditRecordRepository extends JpaRepository<AuditRecordEntity, String> {

    /**
     * 按租户查询（分页，按创建时间倒序）。
     */
    Page<AuditRecordEntity> findByTenantId(String tenantId, Pageable pageable);

    /**
     * 按租户 + action 查询（分页）。
     */
    Page<AuditRecordEntity> findByTenantIdAndAction(String tenantId, String action, Pageable pageable);

    /**
     * 按租户 + actorId 查询（分页）。
     */
    Page<AuditRecordEntity> findByTenantIdAndActorId(String tenantId, String actorId, Pageable pageable);

    /**
     * 按租户 + action 查询（统计用，不分页）。
     */
    List<AuditRecordEntity> findByTenantIdAndAction(String tenantId, String action);

    /**
     * 按租户 + 创建时间范围查询（统计用）。
     */
    List<AuditRecordEntity> findByTenantIdAndCreatedAtBetween(
            String tenantId, OffsetDateTime start, OffsetDateTime end);

    /**
     * 按租户 + actorId + 创建时间范围查询（统计用）。
     */
    List<AuditRecordEntity> findByTenantIdAndActorIdAndCreatedAtBetween(
            String tenantId, String actorId, OffsetDateTime start, OffsetDateTime end);
}
