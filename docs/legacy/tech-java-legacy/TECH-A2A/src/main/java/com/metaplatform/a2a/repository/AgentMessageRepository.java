package com.metaplatform.a2a.repository;

import com.metaplatform.a2a.entity.AgentMessageEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Agent 间消息仓储。
 *
 * <p>对应 Python {@code app.messaging.repository.MessageRepository}。</p>
 */
@Repository
public interface AgentMessageRepository extends JpaRepository<AgentMessageEntity, String> {

    /**
     * 按 ID + 租户查询。
     */
    Optional<AgentMessageEntity> findByIdAndTenantId(String id, String tenantId);

    /**
     * 按租户 + 目标 Agent 查询（收件箱，分页）。
     */
    Page<AgentMessageEntity> findByTenantIdAndToAgentId(
            String tenantId, String toAgentId, Pageable pageable);

    /**
     * 按租户 + 源 Agent 查询（发件箱，分页）。
     */
    Page<AgentMessageEntity> findByTenantIdAndFromAgentId(
            String tenantId, String fromAgentId, Pageable pageable);

    /**
     * 按租户 + 目标 Agent + 状态查询（用于拉取待处理消息队列）。
     */
    List<AgentMessageEntity> findByTenantIdAndToAgentIdAndStatus(
            String tenantId, String toAgentId, String status);

    /**
     * 查询已过期但状态仍为 PENDING 的消息（用于清理任务）。
     */
    List<AgentMessageEntity> findByTenantIdAndStatusAndExpiresAtBefore(
            String tenantId, String status, OffsetDateTime expiresAt);
}
