package com.metaplatform.agent.repository;

import com.metaplatform.agent.entity.AgentStepEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * AgentStep 仓储（对应 agent_steps 表）。
 */
@Repository
public interface AgentStepRepository extends JpaRepository<AgentStepEntity, String> {

    /**
     * 按 executionId 查询所有步骤（时间正序）。
     */
    List<AgentStepEntity> findByTenantIdAndExecutionId(String tenantId, String executionId);

    /**
     * 按 executionId 分页查询步骤。
     */
    Page<AgentStepEntity> findByTenantIdAndExecutionId(String tenantId, String executionId, Pageable pageable);
}
