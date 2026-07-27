package com.metaplatform.a2a.repository;

import com.metaplatform.a2a.entity.AgentRegistrationEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Agent 注册表仓储。
 *
 * <p>对应 Python {@code app.agent_registry.repository.AgentRegistryRepository}。</p>
 */
@Repository
public interface AgentRegistrationRepository extends JpaRepository<AgentRegistrationEntity, String> {

    /**
     * 按 ID + 租户查询。
     */
    Optional<AgentRegistrationEntity> findByIdAndTenantId(String id, String tenantId);

    /**
     * 按租户 + agentId 查询。
     */
    Optional<AgentRegistrationEntity> findByTenantIdAndAgentId(String tenantId, String agentId);

    /**
     * 校验唯一性：(tenant_id, agent_id) 是否已存在。
     */
    boolean existsByTenantIdAndAgentId(String tenantId, String agentId);

    /**
     * 按租户查询（分页）。
     */
    Page<AgentRegistrationEntity> findByTenantId(String tenantId, Pageable pageable);

    /**
     * 按租户 + 状态查询（分页）。
     */
    Page<AgentRegistrationEntity> findByTenantIdAndStatus(String tenantId, String status, Pageable pageable);

    /**
     * 查询心跳早于指定时间的注册记录（用于健康检查 / 标记 UNKNOWN）。
     */
    List<AgentRegistrationEntity> findByTenantIdAndLastHeartbeatBefore(
            String tenantId, OffsetDateTime threshold);
}
