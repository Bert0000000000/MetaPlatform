package com.metaplatform.a2a.repository;

import com.metaplatform.a2a.entity.InboundTaskEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 入站任务仓储。
 *
 * <p>对应 Python {@code app.inbound} 模块的数据访问。</p>
 */
@Repository
public interface InboundTaskRepository extends JpaRepository<InboundTaskEntity, String> {

    /**
     * 按 ID + 租户查询。
     */
    Optional<InboundTaskEntity> findByIdAndTenantId(String id, String tenantId);

    /**
     * 按租户 + 目标 Agent 查询（分页）。
     */
    Page<InboundTaskEntity> findByTenantIdAndTargetAgentId(
            String tenantId, String targetAgentId, Pageable pageable);

    /**
     * 按租户 + 状态查询（分页）。
     */
    Page<InboundTaskEntity> findByTenantIdAndStatus(
            String tenantId, String status, Pageable pageable);

    /**
     * 按租户 + 源 Agent + 状态查询。
     */
    List<InboundTaskEntity> findByTenantIdAndSourceAgentIdAndStatus(
            String tenantId, String sourceAgentId, String status);
}
