package com.metaplatform.agent.repository;

import com.metaplatform.agent.entity.AgentToolEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * AgentTool 仓储（对应 agent_tools 表）。
 */
@Repository
public interface AgentToolRepository extends JpaRepository<AgentToolEntity, String> {

    /**
     * 按 agentId 查询所有工具。
     */
    List<AgentToolEntity> findByTenantIdAndAgentId(String tenantId, String agentId);

    /**
     * 按 agentId 分页查询工具。
     */
    Page<AgentToolEntity> findByTenantIdAndAgentId(String tenantId, String agentId, Pageable pageable);

    /**
     * 按 agentId + enabled 查询工具。
     */
    List<AgentToolEntity> findByTenantIdAndAgentIdAndEnabled(String tenantId, String agentId, String enabled);

    /**
     * 按租户 + 名称 + agentId 查询（用于唯一性校验）。
     */
    Optional<AgentToolEntity> findByTenantIdAndAgentIdAndName(String tenantId, String agentId, String name);

    /**
     * 按 ID + 租户查询工具。
     */
    Optional<AgentToolEntity> findByIdAndTenantId(String id, String tenantId);
}
