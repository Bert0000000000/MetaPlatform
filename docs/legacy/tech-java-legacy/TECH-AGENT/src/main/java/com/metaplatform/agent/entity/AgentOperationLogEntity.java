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
@Table(name = "agent_operation_log")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AgentOperationLogEntity {

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
    @Column(name = "actor", nullable = false, length = 64)
    private String actor;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "action", nullable = false, length = 64)
    private String action;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "resource", nullable = false, length = 128)
    private String resource;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "ip", length = 64)
    private String ip;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "status", nullable = false, length = 16)
    private String status;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "trace_id", length = 64)
    private String traceId;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

}
