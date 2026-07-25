package com.metaplatform.a2a.repository;

import com.metaplatform.a2a.entity.OutboxEventEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * Outbox 事件仓储。
 *
 * <p>对应 Python {@code app.events.outbox.OutboxRepository}。
 * 提供「拉取待中继事件」与「标记已中继」两类核心方法。</p>
 */
@Repository
public interface OutboxEventRepository extends JpaRepository<OutboxEventEntity, String> {

    /**
     * 拉取创建时间早于指定时间、待中继的事件（按创建时间升序，分页）。
     */
    Page<OutboxEventEntity> findByRelayedFalseAndCreatedAtBefore(
            OffsetDateTime before, Pageable pageable);

    /**
     * 拉取所有待中继事件（不分页，用于批量处理）。
     */
    List<OutboxEventEntity> findByRelayedFalse();

    /**
     * 按 eventType 查询待中继事件。
     */
    List<OutboxEventEntity> findByEventTypeAndRelayedFalse(String eventType);

    /**
     * 标记事件已中继。
     *
     * @param eventId    事件 ID
     * @param relayedAt  中继时间
     */
    @Modifying
    @Query("UPDATE OutboxEventEntity e SET e.relayed = true, e.relayedAt = :relayedAt " +
            "WHERE e.eventId = :eventId")
    int markRelayed(@Param("eventId") String eventId,
                    @Param("relayedAt") OffsetDateTime relayedAt);
}
