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
 * Agent 璁板繂娑堟伅 鈥?瀵瑰簲 agent_memory_messages 琛ㄣ€?
 */
@Entity
@Table(name = "agent_memory_messages")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class MemoryMessageEntity {

    @Id
    @Column(name = "id", length = 64, nullable = false)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String id;

    @Column(name = "session_id", length = 64, nullable = false)
    private String sessionId;

    @Column(name = "tenant_id", length = 64, nullable = false)
    private String tenantId;

    @Column(name = "agent_id", length = 64, nullable = false)
    private String agentId;

    @Column(name = "role", length = 32, nullable = false)
    private String role;

    @Column(name = "content", length = 16384, nullable = false)
    private String content;

    @Column(name = "metadata", columnDefinition = "TEXT")
    @JdbcTypeCode(SqlTypes.JSON)
    private String metadata;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;
}
