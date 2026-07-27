package com.metaplatform.agent.repository;

import com.metaplatform.agent.entity.AgentTaskEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * AgentTask 仓储（对应 agent_tasks 表）。
 */
@Repository
public interface AgentTaskRepository extends JpaRepository<AgentTaskEntity, String> {

    /**
     * 按 agentId 分页查询任务。
     */
    Page<AgentTaskEntity> findByTenantIdAndAgentId(String tenantId, String agentId, Pageable pageable);

    /**
     * 按 status 分页查询任务。
     */
    Page<AgentTaskEntity> findByTenantIdAndStatus(String tenantId, String status, Pageable pageable);

    /**
     * 按 agentId + status 查询任务列表。
     */
    List<AgentTaskEntity> findByTenantIdAndAgentIdAndStatus(String tenantId, String agentId, String status);

    /**
     * 按 ID + 租户查询任务。
     */
    Optional<AgentTaskEntity> findByIdAndTenantId(String id, String tenantId);
}
