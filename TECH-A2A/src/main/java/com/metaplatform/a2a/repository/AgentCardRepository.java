package com.metaplatform.a2a.repository;

import com.metaplatform.a2a.entity.AgentCardEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Agent Card 仓储。
 *
 * <p>对应 Python {@code app.agent_card.repository.AgentCardRepository}。</p>
 */
@Repository
public interface AgentCardRepository extends JpaRepository<AgentCardEntity, String> {

    /**
     * 按 ID + 租户查询。
     */
    Optional<AgentCardEntity> findByIdAndTenantId(String id, String tenantId);

    /**
     * 校验唯一性：(tenant_id, name) 是否已存在。
     */
    boolean existsByTenantIdAndName(String tenantId, String name);

    /**
     * 按租户查询（分页）。
     */
    Page<AgentCardEntity> findByTenantId(String tenantId, Pageable pageable);

    /**
     * 按租户 + 状态查询（分页）。
     */
    Page<AgentCardEntity> findByTenantIdAndStatus(String tenantId, String status, Pageable pageable);

    /**
     * 按租户 + 名称查询（用于唯一性校验时取实体）。
     */
    Optional<AgentCardEntity> findByTenantIdAndName(String tenantId, String name);

    /**
     * 查询指定状态的 Agent Card，用于同步 SAA A2A Nacos Registry。
     */
    List<AgentCardEntity> findByStatus(String status);
}
