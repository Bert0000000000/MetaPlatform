package com.metaplatform.agent.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Agent 记忆会话 — 对应 agent_memory_sessions 表。
 * 注意：主键列为 session_id，非 id。
 */
@Entity
@Table(name = "agent_memory_sessions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class MemorySessionEntity {

    @Id
    @Column(name = "session_id", length = 64, nullable = false)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String sessionId;

    @Column(name = "tenant_id", length = 64, nullable = false)
    private String tenantId;

    @Column(name = "agent_id", length = 64, nullable = false)
    private String agentId;

    @Column(name = "title", length = 512)
    private String title;

    @Column(name = "message_count", nullable = false)
    private Integer messageCount;

    @Column(name = "last_message_at")
    private OffsetDateTime lastMessageAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;
}
