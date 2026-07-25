package com.metaplatform.agent.repository;

import com.metaplatform.agent.entity.MemoryMessageEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * MemoryMessage 仓储（对应 agent_memory_messages 表）。
 */
@Repository
public interface MemoryMessageRepository extends JpaRepository<MemoryMessageEntity, String> {

    /**
     * 按 sessionId 查询所有记忆消息（时间正序）。
     */
    List<MemoryMessageEntity> findByTenantIdAndSessionId(String tenantId, String sessionId);

    /**
     * 按 sessionId 分页查询记忆消息。
     */
    Page<MemoryMessageEntity> findByTenantIdAndSessionId(String tenantId, String sessionId, Pageable pageable);

    /**
     * 按 agentId 查询所有记忆消息。
     */
    List<MemoryMessageEntity> findByTenantIdAndAgentId(String tenantId, String agentId);
}
