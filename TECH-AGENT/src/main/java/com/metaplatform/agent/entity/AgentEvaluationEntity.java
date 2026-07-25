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
 * Agent 执行评估 — 对应 agent_evaluations 表。
 */
@Entity
@Table(name = "agent_evaluations")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class AgentEvaluationEntity {

    @Id
    @Column(name = "id", length = 64, nullable = false)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String id;

    @Column(name = "execution_id", length = 64, nullable = false)
    private String executionId;

    @Column(name = "tenant_id", length = 64, nullable = false)
    private String tenantId;

    @Column(name = "score", nullable = false)
    private Double score;

    @Column(name = "feedback", length = 2048)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private String feedback;

    @Column(name = "evaluator", length = 128)
    private String evaluator;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;
}
