package com.metaplatform.agent.repository;

import com.metaplatform.agent.entity.AgentToolCallEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * AgentToolCall 仓储（对应 agent_tool_calls 表）。
 */
@Repository
public interface AgentToolCallRepository extends JpaRepository<AgentToolCallEntity, String> {

    /**
     * 按 executionId 查询所有工具调用记录。
     */
    List<AgentToolCallEntity> findByTenantIdAndExecutionId(String tenantId, String executionId);

    /**
     * 按 executionId 分页查询工具调用记录。
     */
    Page<AgentToolCallEntity> findByTenantIdAndExecutionId(String tenantId, String executionId, Pageable pageable);
}
