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
@Table(name = "agent_checkpoints")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AgentCheckpointEntity {

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "agentId", columnDefinition = "TEXT")
    private String agentId;

    @Id
    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "checkpointId", columnDefinition = "TEXT")
    private String checkpointId;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "createdAt", columnDefinition = "TEXT")
    private OffsetDateTime createdAt;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "executionId", columnDefinition = "TEXT")
    private String executionId;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "state", nullable = false, columnDefinition = "jsonb")
    private String state;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "tenantId", columnDefinition = "TEXT")
    private String tenantId;

}
