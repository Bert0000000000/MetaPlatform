package com.metaplatform.agent.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;

@Entity
@Table(name = "agent_conversations")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AgentConversationEntity {

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "agentId", columnDefinition = "TEXT")
    private String agentId;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "createdAt", columnDefinition = "TEXT")
    private OffsetDateTime createdAt;

    @Column(name = "favorite", nullable = false)
    private Boolean favorite;

    @Id
    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "id", columnDefinition = "TEXT")
    private String id;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "lastMessageAt", columnDefinition = "TEXT")
    private OffsetDateTime lastMessageAt;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "message_count", columnDefinition = "TEXT")
    private Integer messageCount;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "metadata", columnDefinition = "TEXT")
    private String metadata;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "mode", columnDefinition = "TEXT")
    private String mode;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "status", columnDefinition = "TEXT")
    private String status;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "tenantId", columnDefinition = "TEXT")
    private String tenantId;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "title", columnDefinition = "TEXT")
    private String title;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "updatedAt", columnDefinition = "TEXT")
    private OffsetDateTime updatedAt;

}
