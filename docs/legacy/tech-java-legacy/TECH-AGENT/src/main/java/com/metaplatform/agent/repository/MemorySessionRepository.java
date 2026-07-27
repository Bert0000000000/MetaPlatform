package com.metaplatform.agent.repository;

import com.metaplatform.agent.entity.MemorySessionEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * MemorySession 仓储（对应 agent_memory_sessions 表）。
 */
@Repository
public interface MemorySessionRepository extends JpaRepository<MemorySessionEntity, String> {

    /**
     * 按 agentId 分页查询记忆会话。
     */
    Page<MemorySessionEntity> findByTenantIdAndAgentId(String tenantId, String agentId, Pageable pageable);

    /**
     * 按 sessionId + 租户查询。
     */
    Optional<MemorySessionEntity> findBySessionIdAndTenantId(String sessionId, String tenantId);
}
