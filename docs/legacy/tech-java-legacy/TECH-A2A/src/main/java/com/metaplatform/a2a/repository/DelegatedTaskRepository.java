package com.metaplatform.a2a.repository;

import com.metaplatform.a2a.entity.DelegatedTaskEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 委派任务仓储。
 *
 * <p>对应 Python {@code app.delegation.repository.DelegationRepository}。</p>
 */
@Repository
public interface DelegatedTaskRepository extends JpaRepository<DelegatedTaskEntity, String> {

    /**
     * 按 ID + 租户查询。
     */
    Optional<DelegatedTaskEntity> findByIdAndTenantId(String id, String tenantId);

    /**
     * 按租户 + 源 Agent 查询（分页）。
     */
    Page<DelegatedTaskEntity> findByTenantIdAndSourceAgentId(
            String tenantId, String sourceAgentId, Pageable pageable);

    /**
     * 按租户 + 目标 Agent 查询（分页）。
     */
    Page<DelegatedTaskEntity> findByTenantIdAndTargetAgentId(
            String tenantId, String targetAgentId, Pageable pageable);

    /**
     * 按租户 + 状态查询（分页）。
     */
    Page<DelegatedTaskEntity> findByTenantIdAndStatus(
            String tenantId, String status, Pageable pageable);

    /**
     * 按租户 + 目标 Agent + 状态查询（用于拉取待执行任务）。
     */
    List<DelegatedTaskEntity> findByTenantIdAndTargetAgentIdAndStatus(
            String tenantId, String targetAgentId, String status);
}
