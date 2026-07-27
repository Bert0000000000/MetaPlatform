package com.metaplatform.agent.repository;

import com.metaplatform.agent.entity.AgentMessageEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * AgentMessage 仓储。
 */
@Repository
public interface AgentMessageRepository extends JpaRepository<AgentMessageEntity, String> {

    /**
     * 按 conversationId 查询所有消息（时间正序）。
     */
    List<AgentMessageEntity> findByTenantIdAndConversationId(String tenantId, String conversationId);

    /**
     * 按 conversationId 分页查询。
     */
    Page<AgentMessageEntity> findByTenantIdAndConversationId(String tenantId, String conversationId, Pageable pageable);
}
