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
@Table(name = "agent_version")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AgentVersionEntity {

    @Id
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "agent_id", nullable = false, length = 64)
    private String agentId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "version", nullable = false, length = 32)
    private String version;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "change_log", nullable = false, length = 1024)
    private String changeLog;

    @Lob
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "snapshot", columnDefinition = "jsonb")
    private String snapshot;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "created_by", length = 64)
    private String createdBy;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

}
