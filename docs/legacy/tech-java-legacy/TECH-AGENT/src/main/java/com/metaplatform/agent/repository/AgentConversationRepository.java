package com.metaplatform.agent.repository;

import com.metaplatform.agent.entity.AgentConversationEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * AgentConversation 仓储。
 */
@Repository
public interface AgentConversationRepository extends JpaRepository<AgentConversationEntity, String> {

    /**
     * 按租户分页查询对话。
     */
    Page<AgentConversationEntity> findByTenantId(String tenantId, Pageable pageable);

    /**
     * 按 agentId 分页查询对话。
     */
    Page<AgentConversationEntity> findByTenantIdAndAgentId(String tenantId, String agentId, Pageable pageable);

    /**
     * 按 ID + 租户查询。
     */
    Optional<AgentConversationEntity> findByIdAndTenantId(String id, String tenantId);

    /**
     * 按租户 + favorite 查询。
     */
    Page<AgentConversationEntity> findByTenantIdAndFavorite(String tenantId, Boolean favorite, Pageable pageable);
}
