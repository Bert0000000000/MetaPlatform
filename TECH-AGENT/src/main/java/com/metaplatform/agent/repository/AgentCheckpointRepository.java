package com.metaplatform.agent.repository;

import com.metaplatform.agent.entity.AgentCheckpointEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * AgentCheckpoint 仓储。
 */
@Repository
public interface AgentCheckpointRepository extends JpaRepository<AgentCheckpointEntity, String> {

    /**
     * 按 executionId 查询所有检查点。
     */
    List<AgentCheckpointEntity> findByTenantIdAndExecutionId(String tenantId, String executionId);

    /**
     * 按 agentId 查询所有检查点。
     */
    List<AgentCheckpointEntity> findByTenantIdAndAgentId(String tenantId, String agentId);
}
